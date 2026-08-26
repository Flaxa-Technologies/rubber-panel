import db from "./db";
import { sendNodeCommand } from "./node-client";

export async function applyQuotaSuspensionState(
  userId: string,
  isSuspended: boolean,
  reason: string = "QUOTA_FROZEN"
) {
  try {
    const servers = await db.server.findMany({
      where: { ownerId: userId },
      include: { allocations: { orderBy: { port: "asc" } } },
    });

    if (isSuspended) {
      for (const server of servers) {
        if (server.isCreatedFromQuota) {
          // Server was provisioned purely from quota -> Suspend server & stop container
          try {
            await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "POST", { action: "stop" });
          } catch {}

          await db.server.update({
            where: { id: server.id },
            data: {
              status: "STOPPED",
              suspended: true,
              suspensionReason: reason,
            },
          });
        } else {
          // Server has a paid base plan -> Revoke all extra RAM, CPU, Disk, and extra Ports!
          const targetRam = server.baseRam || 1024;
          const targetCpu = server.baseCpu || 100;
          const targetDisk = server.baseDisk || 5120;

          await db.server.update({
            where: { id: server.id },
            data: {
              ram: targetRam,
              cpu: targetCpu,
              disk: targetDisk,
              extraRam: 0,
              extraCpu: 0,
              extraDisk: 0,
            },
          });

          // Free all extra secondary ports beyond the primary connection port
          if (server.allocations && server.allocations.length > 1) {
            const extraAllocIds = server.allocations.slice(1).map((a) => a.id);
            await db.allocation.updateMany({
              where: { id: { in: extraAllocIds } },
              data: { assigned: false, serverId: null },
            });
          }

          // Scale down container on node to base resources
          try {
            await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "POST", {
              action: "scale",
              ram: targetRam,
              cpu: targetCpu,
              disk: targetDisk,
            });
          } catch {}
        }
      }
    } else {
      // Quota un-frozen / reactivated -> lift suspension on quota-created instances if they were frozen
      for (const server of servers) {
        if (server.isCreatedFromQuota && server.suspended && (server.suspensionReason === "QUOTA_FROZEN" || server.suspensionReason === "QUOTA_SUSPENDED")) {
          await db.server.update({
            where: { id: server.id },
            data: {
              suspended: false,
              suspensionReason: null,
            },
          });
        }
      }
    }
  } catch (err: any) {
    console.error("[applyQuotaSuspensionState] Error:", err);
  }
}
