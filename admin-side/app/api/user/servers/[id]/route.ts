import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  const bypass = request.headers.get("x-bypass-restrictions") === "true";
  return { internalSecret, expectedSecret, userId, bypass };
}

// GET /api/user/servers/[id] — Get single server (owner, admin, or subuser)
export async function GET(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;

  const access = await verifyServerAccess(id, userId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 404 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: {
      id: true, name: true, uuid: true, status: true, suspended: true,
      ram: true, cpu: true, disk: true, swap: true, createdAt: true,
      ownerId: true,
      startupCommand: true, allowedPaths: true, protectedPaths: true, blockedUploadPaths: true, allowNodeTransfer: true,
      serverType: true, nodeVersion: true, securityProtection: true, securitySuspendedUntil: true, securityQuarantineReason: true,
      javaVersion: true, javaVersionId: true, internalPort: true,
      cryoSleepEnabled: true, cryoSleepIdleMinutes: true, cryoSleepCustomMotdAllowed: true, cryoSleepMotd: true,
      isSandbox: true, sandboxRuntime: true, sandboxDailyHoursLimit: true, sandboxUsedMinutesToday: true,
      sandboxAutoShutdownMinutes: true, sandboxPassword: true,
      node: { select: { id: true, name: true, status: true, fqdn: true, port: true } },
      software: { select: { name: true, type: true } },
      softwareVersion: { select: { version: true } },
      allocations: { select: { id: true, ip: true, port: true }, orderBy: { port: "asc" } },
      backups: { select: { id: true, name: true, status: true, size: true, createdAt: true }, take: 10 },
      subusers: {
        where: { userId },
        select: { roleName: true, permissions: true },
      },
    },
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });
  }

  let liveStats: any = {};
  if (server.node?.id) {
    try {
      const nodeRes = await sendNodeCommand(server.node.id, `/api/agent/servers/${server.id}`, "GET");
      if (nodeRes.success && nodeRes.data) {
        liveStats = nodeRes.data;
        if (liveStats.status && liveStats.status !== server.status) {
          db.server.update({ where: { id: server.id }, data: { status: liveStats.status } }).catch(() => {});
        }
      }
    } catch {}
  }

  const formatted = {
    ...server,
    status: liveStats.status || server.status,
    isCryoSleeping: liveStats.isCryoSleeping || liveStats.status === "SLEEPING",
    diskUsedMb: liveStats.diskUsedMb ?? 0,
    diskUsedBytes: liveStats.diskUsedBytes ?? 0,
    ramUsageMb: liveStats.ramUsageMb ?? 0,
    cpuUsage: liveStats.cpuUsage ?? 0,
    isOwner: server.ownerId === userId || access.isAdmin,
    subuserRole: server.subusers[0]?.roleName ?? (server.ownerId === userId ? "Owner" : "Admin"),
    subuserPermissions: server.subusers[0]?.permissions ?? "[\"*\"]",
  };

  return NextResponse.json(formatted);
}

// POST /api/user/servers/[id] — Power actions with permission checks
export async function POST(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action as string;

  if (!["start", "stop", "restart", "kill", "wake", "hibernate"].includes(action)) {
    return NextResponse.json({ error: "Invalid power action" }, { status: 400 });
  }

  const reqPerm = (action === "start" || action === "wake") ? "control.start" : (action === "stop" || action === "hibernate") ? "control.stop" : "control.restart";
  const access = await verifyServerAccess(id, userId, reqPerm);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true, status: true },
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "Server is suspended. Contact support." }, { status: 403 });
  }

  // Handle Cryo-Sleep wake or hibernate specifically
  if (action === "wake" || action === "hibernate") {
    const nodeRes = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/cryosleep`, "POST", { action, trigger: `User Panel Trigger (${userId})` });
    if (!nodeRes.success) {
      return NextResponse.json({ error: nodeRes.error }, { status: 503 });
    }
    const targetStatus = action === "wake" ? "RUNNING" : "SLEEPING";
    await db.server.update({ where: { id: server.id }, data: { status: targetStatus } }).catch(() => {});
    return NextResponse.json({ success: true, action });
  }

  let result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "POST", { action });

  // Self-healing auto-provision fallback: If the server is not on the node, provision it and start it
  if (!result.success && action === "start" && (result.error?.includes("Server not found") || result.error?.includes("404") || result.error?.includes("not found"))) {
    const fullServer = await db.server.findUnique({
      where: { id: server.id },
      include: { allocations: true },
    });
    if (fullServer) {
      const assignedPort = fullServer.allocations[0]?.port || 25565;
      const parsedEnv = fullServer.environment ? JSON.parse(fullServer.environment) : {};

      await sendNodeCommand(server.nodeId, `/api/agent/servers`, "POST", {
        id: fullServer.id,
        name: fullServer.name,
        ram: fullServer.ram,
        cpu: fullServer.cpu,
        disk: fullServer.disk,
        port: assignedPort,
        startupCommand: fullServer.startupCommand,
        environment: parsedEnv,
      });

      result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "POST", { action });
    }
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  const targetStatus = (action === "start" || action === "restart") ? "RUNNING" : "STOPPED";
  await db.server.update({ where: { id: server.id }, data: { status: targetStatus } }).catch(() => {});

  return NextResponse.json({ success: true, action });
}

// PATCH /api/user/servers/[id] — Update server settings (name, startupCommand, Cryo-Sleep MOTD)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const access = await verifyServerAccess(id, userId, "settings.edit");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({ where: { id } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.name && typeof body.name === "string") updateData.name = body.name.trim();
  if (body.startupCommand !== undefined) updateData.startupCommand = body.startupCommand;

  // Cryo-Sleep settings update
  if (body.cryoSleepMotd !== undefined) {
    if (server.cryoSleepCustomMotdAllowed || access.isAdmin) {
      updateData.cryoSleepMotd = body.cryoSleepMotd || null;
    } else {
      return NextResponse.json({ error: "Custom MOTD modification is restricted by administration for this instance." }, { status: 403 });
    }
  }

  if (body.cryoSleepIdleMinutes !== undefined && access.isAdmin) {
    updateData.cryoSleepIdleMinutes = Math.max(1, parseInt(body.cryoSleepIdleMinutes) || 10);
  }

  const updated = await db.server.update({
    where: { id },
    data: updateData,
  });

  // Sync with node if cryosleep settings changed
  if (body.cryoSleepMotd !== undefined) {
    sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/cryosleep`, "POST", {
      action: "config",
      motd: updateData.cryoSleepMotd || server.cryoSleepMotd,
      enabled: server.cryoSleepEnabled,
      idleMinutes: server.cryoSleepIdleMinutes,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, server: updated });
}
