import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string }> };
type Actor = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<Actor | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as Actor) : null;
}

function isInternalCall(request: NextRequest): boolean {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(internalSecret && expectedSecret && internalSecret === expectedSecret);
}

// GET /api/admin/servers/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  const isInternal = isInternalCall(request);
  const actor = await getActor(request);
  if (!isInternal && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;

  const server = await db.server.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      node: { select: { id: true, name: true, fqdn: true, status: true } },
      software: true,
      softwareVersion: true,
      allocations: { orderBy: { port: "asc" } },
      backups: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  return NextResponse.json(server);
}

// PATCH /api/admin/servers/[id] — Full edit: resources, owner, software, paths, etc.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const isInternal = isInternalCall(request);
  const actor = await getActor(request);
  if (!isInternal && (!actor || !isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SERVERS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json();

  const server = await db.server.findUnique({ where: { id } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  // Build update payload — only include fields that were explicitly provided
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.suspended !== undefined) {
    data.suspended = body.suspended;
    data.status = "OFFLINE";
    if (body.suspended) {
      // Immediately stop running container on node
      try {
        await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", { action: "kill" });
      } catch (err) {
        console.error("Failed to stop container on suspend:", err);
      }
    }
  }
  if (body.ram !== undefined) data.ram = parseInt(body.ram);
  if (body.cpu !== undefined) data.cpu = parseInt(body.cpu);
  if (body.disk !== undefined) data.disk = parseInt(body.disk);
  if (body.swap !== undefined) data.swap = parseInt(body.swap) || 0;
  if (body.startupCommand !== undefined) data.startupCommand = body.startupCommand;
  if (body.ownerId !== undefined) data.ownerId = body.ownerId;
  if (body.softwareId !== undefined) data.softwareId = body.softwareId || null;
  if (body.softwareVersionId !== undefined) data.softwareVersionId = body.softwareVersionId || null;
  if (body.serverType !== undefined) data.serverType = body.serverType;
  if (body.nodeVersion !== undefined) {
    data.nodeVersion = body.nodeVersion;
    try {
      const currentEnv = JSON.parse(server.environment || "{}");
      currentEnv.NODE_VERSION = body.nodeVersion;
      if (server.serverType === "NODEJS" || body.serverType === "NODEJS") {
        currentEnv.DOCKER_IMAGE = `node:${body.nodeVersion}-alpine`;
      }
      data.environment = JSON.stringify(currentEnv);
    } catch {}
  }
  if (body.securityProtection !== undefined) {
    data.securityProtection = Boolean(body.securityProtection);
    try {
      const currentEnv = JSON.parse((data.environment as string) || server.environment || "{}");
      currentEnv.SECURITY_PROTECTION = String(Boolean(body.securityProtection));
      data.environment = JSON.stringify(currentEnv);
    } catch {}
  }
  if (body.javaVersion !== undefined) {
    const cleanJava = String(body.javaVersion).trim();
    data.javaVersion = cleanJava;
    try {
      const currentEnv = JSON.parse((data.environment as string) || server.environment || "{}");
      currentEnv.JAVA_VERSION = cleanJava;
      if (server.serverType === "MINECRAFT" || body.serverType === "MINECRAFT" || currentEnv.SERVER_TYPE === "MINECRAFT") {
        currentEnv.DOCKER_IMAGE = `itzg/minecraft-server:java${cleanJava}`;
      }
      data.environment = JSON.stringify(currentEnv);
    } catch {}
  }
  if (body.javaVersionId !== undefined) data.javaVersionId = body.javaVersionId || null;
  // Permissions
  if (body.allowedPaths !== undefined) {
    // Accept array or comma-string
    const arr = Array.isArray(body.allowedPaths)
      ? body.allowedPaths
      : String(body.allowedPaths).split(",").map((p: string) => p.trim()).filter(Boolean);
    data.allowedPaths = JSON.stringify(arr);
  }
  if (body.protectedPaths !== undefined) {
    const arr = Array.isArray(body.protectedPaths)
      ? body.protectedPaths
      : String(body.protectedPaths).split(",").map((p: string) => p.trim()).filter(Boolean);
    data.protectedPaths = JSON.stringify(arr);
  }
  if (body.blockedUploadPaths !== undefined) {
    const arr = Array.isArray(body.blockedUploadPaths)
      ? body.blockedUploadPaths
      : String(body.blockedUploadPaths).split(",").map((p: string) => p.trim()).filter(Boolean);
    data.blockedUploadPaths = JSON.stringify(arr);
  }
  if (body.allowNodeTransfer !== undefined) {
    data.allowNodeTransfer = Boolean(body.allowNodeTransfer);
  }
  if (body.expiresAt !== undefined) {
    data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  }
  if (body.gracePeriodDays !== undefined) {
    data.gracePeriodDays = parseInt(body.gracePeriodDays);
  }
  if (body.autoSuspendOnExpiry !== undefined) {
    data.autoSuspendOnExpiry = Boolean(body.autoSuspendOnExpiry);
  }
  if (body.autoDeleteOnGraceExpiry !== undefined) {
    data.autoDeleteOnGraceExpiry = Boolean(body.autoDeleteOnGraceExpiry);
  }
  if (body.suspensionReason !== undefined) {
    data.suspensionReason = body.suspensionReason;
  }
  if (body.allowGoogleDriveBackups !== undefined) {
    data.allowGoogleDriveBackups = Boolean(body.allowGoogleDriveBackups);
  }
  if (body.cryoSleepEnabled !== undefined) {
    data.cryoSleepEnabled = Boolean(body.cryoSleepEnabled);
  }
  if (body.cryoSleepIdleMinutes !== undefined) {
    data.cryoSleepIdleMinutes = Math.max(1, parseInt(body.cryoSleepIdleMinutes) || 10);
  }
  if (body.cryoSleepCustomMotdAllowed !== undefined) {
    data.cryoSleepCustomMotdAllowed = Boolean(body.cryoSleepCustomMotdAllowed);
  }
  if (body.cryoSleepMotd !== undefined) {
    data.cryoSleepMotd = body.cryoSleepMotd || null;
  }

  // Handle port allocations update if provided
  if (body.assignedAllocationIds && Array.isArray(body.assignedAllocationIds)) {
    // 1. Unassign allocations no longer in the list
    await db.allocation.updateMany({
      where: {
        serverId: id,
        id: { notIn: body.assignedAllocationIds },
      },
      data: { assigned: false, serverId: null },
    });

    // 2. Assign allocations in the list to this server
    if (body.assignedAllocationIds.length > 0) {
      await db.allocation.updateMany({
        where: {
          id: { in: body.assignedAllocationIds },
        },
        data: { assigned: true, serverId: id },
      });
    }
  }

  // Handle 1-click assigning next available free port(s) from node
  if (body.assignNextFreePort || body.assignExtraPortsCount) {
    const count = typeof body.assignExtraPortsCount === "number" ? body.assignExtraPortsCount : 1;
    const node = await db.node.findUnique({ where: { id: server.nodeId } });
    if (node) {
      const freeAllocs = await db.allocation.findMany({
        where: { nodeId: server.nodeId, assigned: false },
        take: count,
        orderBy: { port: "asc" },
      });

      for (const freeAlloc of freeAllocs) {
        await db.allocation.update({
          where: { id: freeAlloc.id },
          data: { assigned: true, serverId: id },
        });
      }

      // If more allocations were needed than existed in pool, auto-generate them
      const remainingNeeded = count - freeAllocs.length;
      if (remainingNeeded > 0) {
        const usedPorts = await db.allocation.findMany({
          where: { nodeId: server.nodeId },
          select: { port: true },
        });
        const usedSet = new Set(usedPorts.map((p) => p.port));
        let nextPort = 25565;
        let created = 0;
        while (created < remainingNeeded && nextPort <= 65535) {
          if (!usedSet.has(nextPort)) {
            await db.allocation.create({
              data: {
                nodeId: server.nodeId,
                ip: node.fqdn,
                port: nextPort,
                assigned: true,
                serverId: id,
              },
            });
            usedSet.add(nextPort);
            created++;
          }
          nextPort++;
        }
      }
    }
  }

  // Handle single port assignment
  if (body.assignAllocationId) {
    await db.allocation.update({
      where: { id: body.assignAllocationId },
      data: { assigned: true, serverId: id },
    });
  }

  // Handle single port unassignment
  if (body.unassignAllocationId) {
    await db.allocation.update({
      where: { id: body.unassignAllocationId },
      data: { assigned: false, serverId: null },
    });
  }

  // Handle creating & assigning a custom port directly to this server
  if (body.createAndAssignPort && typeof body.createAndAssignPort === "number") {
    const node = await db.node.findUnique({ where: { id: server.nodeId } });
    if (node) {
      const existingAlloc = await db.allocation.findFirst({
        where: { nodeId: server.nodeId, port: body.createAndAssignPort },
      });
      if (!existingAlloc) {
        await db.allocation.create({
          data: {
            nodeId: server.nodeId,
            ip: node.fqdn,
            port: body.createAndAssignPort,
            assigned: true,
            serverId: id,
          },
        });
      } else {
        await db.allocation.update({
          where: { id: existingAlloc.id },
          data: { assigned: true, serverId: id },
        });
      }
    }
  }

  const updated = await db.server.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      suspended: true,
      ram: true,
      cpu: true,
      disk: true,
      allowedPaths: true,
      protectedPaths: true,
      blockedUploadPaths: true,
      allowNodeTransfer: true,
      expiresAt: true,
      gracePeriodDays: true,
      autoSuspendOnExpiry: true,
      autoDeleteOnGraceExpiry: true,
      suspensionReason: true,
      allocations: true,
    },
  });

  // Sync Cryo-Sleep configuration with node daemon if modified
  if (body.cryoSleepEnabled !== undefined || body.cryoSleepIdleMinutes !== undefined || body.cryoSleepMotd !== undefined) {
    try {
      const isEnabled = body.cryoSleepEnabled !== undefined ? Boolean(body.cryoSleepEnabled) : (data.cryoSleepEnabled ?? server.cryoSleepEnabled);
      const idleMin = body.cryoSleepIdleMinutes !== undefined ? Math.max(1, parseInt(body.cryoSleepIdleMinutes) || 10) : (data.cryoSleepIdleMinutes ?? server.cryoSleepIdleMinutes);
      const motd = body.cryoSleepMotd !== undefined ? (body.cryoSleepMotd || null) : (data.cryoSleepMotd !== undefined ? data.cryoSleepMotd : server.cryoSleepMotd);
      const alloc = await db.allocation.findFirst({ where: { serverId: id } });
      const port = alloc?.port ?? server.internalPort ?? 25565;

      await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/cryosleep`, "POST", {
        action: "config",
        name: server.name,
        port,
        serverType: server.serverType,
        enabled: isEnabled,
        idleMinutes: idleMin,
        motd,
      });
    } catch (err: any) {
      console.warn(`[Cryo-Sleep] Failed to sync config to node for server ${id}:`, err.message);
    }
  }

  const action = body.suspended !== undefined
    ? (body.suspended ? "SERVER_SUSPENDED" : "SERVER_UNSUSPENDED")
    : "SERVER_UPDATED";

  await createAuditLog({
    actorId: actor?.id || "system", actorEmail: actor?.email || "internal",
    action: action as any,
    target: server.name, targetId: server.id,
    ipAddress: getIpFromRequest(request),
    metadata: { changes: Object.keys(data) },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/servers/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  const isInternal = isInternalCall(request);
  const actor = await getActor(request);
  if (!isInternal && (!actor || !isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SERVERS_DELETE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;

  const server = await db.server.findUnique({ where: { id } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  // 1. Delete files on the node-side
  await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "DELETE");

  // 1.5. Clean up any Cloudflare SRV DNS records associated with server's subdomains
  try {
    const serverSubdomains = await db.subdomain.findMany({
      where: { serverId: id },
      include: { domain: true },
    });
    for (const sub of serverSubdomains) {
      if (sub.srvRecordId && sub.domain?.apiToken && sub.domain?.zoneId) {
        try {
          const { deleteDnsRecord } = await import("@/lib/dns/cloudflare");
          await deleteDnsRecord(sub.domain.apiToken, sub.domain.zoneId, sub.srvRecordId);
        } catch (e) {
          console.error(`[DNS Cleanup] Failed to delete SRV record for ${sub.fqdn}:`, e);
        }
      }
    }
  } catch (err) {
    console.error("[DNS Cleanup] Error querying subdomains for deletion:", err);
  }

  // 2. Free any allocations assigned to this server
  await db.allocation.updateMany({
    where: { serverId: id },
    data: { assigned: false }, // serverId is set to null via SetNull cascade automatically, but we explicitly reset assigned
  });

  // 3. Delete the server from the database (Cascade deletes Subdomain DB records)
  await db.server.delete({ where: { id } });

  await createAuditLog({
    actorId: actor?.id || "system", actorEmail: actor?.email || "internal",
    action: "SERVER_DELETED", target: server.name, targetId: server.id,
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({ success: true });
}
