import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

async function getActor(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; email: string; role: string; username: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const node = await db.node.findUnique({
    where: { id },
    include: {
      servers: { select: { id: true, name: true, status: true, ownerId: true }, take: 20 },
      allocations: { take: 50 },
      _count: { select: { servers: true, allocations: true } },
    },
  });

  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  const { authToken, ...safeNode } = node;
  return NextResponse.json(safeNode);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.NODES_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const node = await db.node.findUnique({ where: { id } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const allowed = [
    "name", "fqdn", "port", "location", "description", "maintenanceMode",
    "maxCpu", "maxRam", "maxDisk", "portRangeStart", "portRangeEnd",
    "autoStartServersOnBoot", "bootCryoSleepMode", "bootGracePeriodSeconds",
    "maxConcurrentBootStarts", "bootStartupDelaySeconds"
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  if (data.maintenanceMode !== undefined) {
    data.status = data.maintenanceMode ? "MAINTENANCE" : node.status === "MAINTENANCE" ? "OFFLINE" : node.status;
  }

  const updated = await db.node.update({
    where: { id },
    data,
    select: { id: true, name: true, fqdn: true, status: true, maintenanceMode: true },
  });

  if (body.maintenanceMode !== undefined) {
    await createAuditLog({
      actorId: actor.id, actorEmail: actor.email,
      action: "NODE_MAINTENANCE_TOGGLED",
      target: node.name, targetId: node.id,
      ipAddress: getIpFromRequest(request),
      metadata: { maintenanceMode: body.maintenanceMode },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.NODES_DELETE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const node = await db.node.findUnique({ where: { id }, include: { _count: { select: { servers: true } } } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  if (node._count.servers > 0) {
    return NextResponse.json({ error: "Cannot delete node with active servers. Migrate servers first." }, { status: 400 });
  }

  await db.node.delete({ where: { id } });
  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "NODE_DELETED",
    target: node.name, targetId: node.id,
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({ success: true });
}
