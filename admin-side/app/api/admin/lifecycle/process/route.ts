import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendNodeCommand, getNodeBaseUrl } from "@/lib/node-client";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  const now = new Date();
  const results = {
    serversSuspended: 0,
    serversDowngraded: 0,
    serversDeleted: 0,
    quotasExpired: 0,
    errors: [] as string[],
  };

  try {
    // 1. Process Expired Extra Resource Quotas
    const expiredQuotas = await db.userResourceQuota.findMany({
      where: {
        isSuspended: false,
        expiresAt: { lt: now },
      },
      include: {
        user: {
          include: { servers: { include: { node: true } } },
        },
      },
    });

    for (const quota of expiredQuotas) {
      try {
        for (const server of quota.user.servers) {
          if (server.isCreatedFromQuota) {
            // Server was created solely using this quota -> Suspend server
            if (!server.suspended) {
              try {
                await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", { action: "stop" });
              } catch {}
              await db.server.update({
                where: { id: server.id },
                data: { suspended: true, suspensionReason: "QUOTA_EXPIRED" },
              });
              results.serversSuspended++;
            }
          } else if (server.extraRam > 0 || server.extraCpu > 0 || server.extraDisk > 0) {
            // Server has paid base plan but extra quota expired -> Revoke extra boost and restore base resources!
            const newRam = server.baseRam || 1024;
            const newCpu = server.baseCpu || 100;
            const newDisk = server.baseDisk || 5120;

            await db.server.update({
              where: { id: server.id },
              data: {
                ram: newRam,
                cpu: newCpu,
                disk: newDisk,
                extraRam: 0,
                extraCpu: 0,
                extraDisk: 0,
              },
            });

            // Update container on node daemon
            try {
              await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", {
                action: "update_resources",
                ram: newRam,
                cpu: newCpu,
                disk: newDisk,
              });
            } catch {}

            results.serversDowngraded++;
          }
        }

        await db.userResourceQuota.update({
          where: { id: quota.id },
          data: {
            isSuspended: true,
            suspendedReason: "SUBSCRIPTION_EXPIRED",
          },
        });

        results.quotasExpired++;
      } catch (err: any) {
        results.errors.push(`Quota ${quota.id} expiry error: ${err.message}`);
      }
    }

    // 2. Process Expired Base Servers
    const expiredServers = await db.server.findMany({
      where: {
        suspended: false,
        autoSuspendOnExpiry: true,
        expiresAt: { lt: now },
      },
      include: { node: true, owner: { include: { resourceQuota: true } } },
    });

    for (const server of expiredServers) {
      try {
        const userQuota = server.owner.resourceQuota;
        const quotaActive = userQuota && !userQuota.isSuspended && (!userQuota.expiresAt || new Date(userQuota.expiresAt) > now);

        if (quotaActive && server.extraRam > 0) {
          // User paid for extra resources but main server plan expired:
          // Keep server running on its extra quota resources!
          const newRam = server.extraRam;
          const newCpu = server.extraCpu || 50;
          const newDisk = server.extraDisk || 2048;

          await db.server.update({
            where: { id: server.id },
            data: {
              ram: newRam,
              cpu: newCpu,
              disk: newDisk,
              baseRam: 0,
              baseCpu: 0,
              baseDisk: 0,
              isCreatedFromQuota: true,
            },
          });

          try {
            await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", {
              action: "update_resources",
              ram: newRam,
              cpu: newCpu,
              disk: newDisk,
            });
          } catch {}

          results.serversDowngraded++;
        } else {
          // Gracefully stop container and mark suspended
          try {
            await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", {
              action: "stop",
              waitSeconds: 5,
            });
          } catch {}

          await db.server.update({
            where: { id: server.id },
            data: {
              suspended: true,
              suspensionReason: "PAYMENT_DUE",
            },
          });

          results.serversSuspended++;
        }
      } catch (err: any) {
        results.errors.push(`Server ${server.id} suspension error: ${err.message}`);
      }
    }

    // 3. Process Grace Period Expired Servers for Auto-Deletion
    const graceExpiredServers = await db.server.findMany({
      where: {
        autoDeleteOnGraceExpiry: true,
        expiresAt: { not: null },
      },
      include: { node: true },
    });

    for (const server of graceExpiredServers) {
      if (!server.expiresAt) continue;
      const graceEnd = new Date(server.expiresAt);
      graceEnd.setDate(graceEnd.getDate() + server.gracePeriodDays);

      if (now > graceEnd) {
        try {
          try {
            await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", { action: "kill" });
            const nodeUrl = getNodeBaseUrl(server.node);
            await fetch(`${nodeUrl}/api/agent/servers/${server.id}/transfer/cleanup`, {
              method: "POST",
              headers: { Authorization: `Bearer ${server.node.authToken}` },
            });
          } catch {}

          await db.$transaction(async (tx) => {
            await tx.allocation.updateMany({
              where: { serverId: server.id },
              data: { assigned: false, serverId: null },
            });
            await tx.server.delete({ where: { id: server.id } });
          });

          results.serversDeleted++;
        } catch (err: any) {
          results.errors.push(`Server ${server.id} auto-delete error: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lifecycle processing failed" }, { status: 500 });
  }
}
