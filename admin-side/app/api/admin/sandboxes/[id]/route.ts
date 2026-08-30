import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/sandboxes/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!session?.user || !isAdminRole(actor?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const sandbox = await db.server.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      node: { select: { id: true, name: true, fqdn: true, status: true } },
      allocations: { select: { id: true, ip: true, port: true }, orderBy: { port: "asc" } },
      customImage: true,
    },
  });

  if (!sandbox || (!sandbox.isSandbox && sandbox.serverType !== "CODESANDBOX")) {
    return NextResponse.json({ error: "Code Sandbox not found" }, { status: 404 });
  }

  return NextResponse.json(sandbox);
}

// PATCH /api/admin/sandboxes/[id]
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!session?.user || !isAdminRole(actor?.role ?? "") || !hasPermission(actor?.role as any, PERMISSIONS.SERVERS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const sandbox = await db.server.findUnique({ where: { id } });
  if (!sandbox) return NextResponse.json({ error: "Code Sandbox not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.ram !== undefined) data.ram = parseInt(body.ram);
  if (body.cpu !== undefined) data.cpu = parseInt(body.cpu);
  if (body.disk !== undefined) data.disk = parseInt(body.disk);
  if (body.swap !== undefined) data.swap = parseInt(body.swap) || 0;
  if (body.ownerId !== undefined) data.ownerId = body.ownerId;
  if (body.sandboxRuntime !== undefined) data.sandboxRuntime = body.sandboxRuntime;
  if (body.sandboxDailyHoursLimit !== undefined) data.sandboxDailyHoursLimit = parseInt(body.sandboxDailyHoursLimit) || 0;
  if (body.sandboxAutoShutdownMinutes !== undefined) data.sandboxAutoShutdownMinutes = parseInt(body.sandboxAutoShutdownMinutes) || 0;
  if (body.sandboxPassword !== undefined) data.sandboxPassword = body.sandboxPassword?.trim() || null;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.gracePeriodDays !== undefined) data.gracePeriodDays = parseInt(body.gracePeriodDays);
  if (body.autoSuspendOnExpiry !== undefined) data.autoSuspendOnExpiry = Boolean(body.autoSuspendOnExpiry);
  if (body.autoDeleteOnGraceExpiry !== undefined) data.autoDeleteOnGraceExpiry = Boolean(body.autoDeleteOnGraceExpiry);
  if (body.suspended !== undefined) {
    data.suspended = Boolean(body.suspended);
    if (body.suspended) {
      try {
        await sendNodeCommand(sandbox.nodeId, `/api/agent/servers/${sandbox.id}/power`, "POST", { action: "kill" });
      } catch {}
    }
  }

  if (body.sandboxPassword !== undefined) {
    try {
      const currentEnv = JSON.parse(sandbox.environment || "{}");
      currentEnv.SANDBOX_PASSWORD = body.sandboxPassword?.trim() || "";
      data.environment = JSON.stringify(currentEnv);
    } catch {}
  }

  const updated = await db.server.update({
    where: { id },
    data,
    include: {
      owner: { select: { username: true, email: true } },
      node: { select: { name: true } },
    }
  });

  await createAuditLog({
    actorId: actor?.id ?? "unknown",
    actorEmail: actor?.email ?? "unknown",
    action: "CODESANDBOX_EDIT",
    target: "SERVER",
    targetId: id,
    metadata: { changes: Object.keys(data) },
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/sandboxes/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!session?.user || !isAdminRole(actor?.role ?? "") || !hasPermission(actor?.role as any, PERMISSIONS.SERVERS_DELETE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const sandbox = await db.server.findUnique({ where: { id } });
  if (!sandbox) return NextResponse.json({ error: "Code Sandbox not found" }, { status: 404 });

  // 1. Terminate on node daemon
  try {
    await sendNodeCommand(sandbox.nodeId, `/api/agent/servers/${id}`, "DELETE");
  } catch (err: any) {
    console.warn("[AdminSandboxes] Failed to delete container on node daemon:", err?.message);
  }

  // 2. Unassign allocations
  await db.allocation.updateMany({
    where: { serverId: id },
    data: { assigned: false, serverId: null },
  });

  // 3. Delete database record
  await db.server.delete({ where: { id } });

  await createAuditLog({
    actorId: actor?.id ?? "unknown",
    actorEmail: actor?.email ?? "unknown",
    action: "CODESANDBOX_DELETE",
    target: "SERVER",
    targetId: id,
    metadata: { name: sandbox.name, ownerId: sandbox.ownerId },
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({ success: true });
}
