import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

const ipSchema = z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address");

const createAllocationSchema = z.object({
  nodeId: z.string().uuid(),
  ip: ipSchema,
  port: z.number().int().min(1024).max(65535),
  alias: z.string().optional(),
});

const bulkCreateSchema = z.object({
  nodeId: z.string().uuid(),
  ip: ipSchema,
  portStart: z.number().int().min(1024),
  portEnd: z.number().int().max(65535),
});

const patchAllocationSchema = z.object({
  id: z.string().uuid(),
  disabled: z.boolean().optional(),
  alias: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("nodeId");
  const assigned = searchParams.get("assigned");
  const disabled = searchParams.get("disabled");
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "200");

  const where: Record<string, unknown> = {};
  if (nodeId) where.nodeId = nodeId;
  if (assigned !== null && assigned !== undefined && assigned !== "all") {
    where.assigned = assigned === "true";
  }
  if (disabled !== null && disabled !== undefined && disabled !== "all") {
    where.disabled = disabled === "true";
  }
  if (search) {
    const portNum = parseInt(search);
    if (!isNaN(portNum)) {
      where.port = portNum;
    } else {
      where.OR = [
        { ip: { contains: search } },
        { alias: { contains: search } },
      ];
    }
  }

  const [allocations, total] = await Promise.all([
    db.allocation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ nodeId: "asc" }, { port: "asc" }],
      include: {
        node: { select: { id: true, name: true, fqdn: true } },
        server: { select: { id: true, name: true } },
      },
    }),
    db.allocation.count({ where }),
  ]);

  return NextResponse.json({ allocations, total, page, limit });
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.ALLOCATIONS_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Bulk creation
  if (body.portStart !== undefined && body.portEnd !== undefined) {
    const parsed = bulkCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const { nodeId, ip, portStart, portEnd } = parsed.data;
    if (portEnd < portStart) {
      return NextResponse.json({ error: "End port must be greater than or equal to start port" }, { status: 400 });
    }
    if (portEnd - portStart > 500) {
      return NextResponse.json({ error: "Cannot create more than 500 allocations at once" }, { status: 400 });
    }

    const ports = Array.from({ length: portEnd - portStart + 1 }, (_, i) => portStart + i);
    let created = 0;
    for (const port of ports) {
      try {
        const existing = await db.allocation.findFirst({ where: { nodeId, port } });
        if (existing) continue;
        await db.allocation.create({ data: { nodeId, ip, port } });
        created++;
      } catch {
        // Skip duplicates
      }
    }

    await createAuditLog({
      actorId: actor.id, actorEmail: actor.email,
      action: "ALLOCATION_CREATED",
      ipAddress: getIpFromRequest(request),
      metadata: { nodeId, ip, portStart, portEnd, created },
    });

    return NextResponse.json({ created }, { status: 201 });
  }

  // Single creation
  const parsed = createAllocationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const existingPort = await db.allocation.findFirst({
    where: { nodeId: parsed.data.nodeId, port: parsed.data.port },
  });
  if (existingPort) {
    return NextResponse.json({ error: `Port ${parsed.data.port} is already assigned on this node (IP: ${existingPort.ip})` }, { status: 409 });
  }

  try {
    const allocation = await db.allocation.create({ data: parsed.data });
    await createAuditLog({
      actorId: actor.id, actorEmail: actor.email,
      action: "ALLOCATION_CREATED",
      targetId: allocation.id,
      ipAddress: getIpFromRequest(request),
      metadata: { nodeId: parsed.data.nodeId, ip: parsed.data.ip, port: parsed.data.port },
    });
    return NextResponse.json(allocation, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Allocation already exists for this IP/port on this node" }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = patchAllocationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { id, disabled, alias } = parsed.data;
  const alloc = await db.allocation.findUnique({ where: { id } });
  if (!alloc) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });

  const updated = await db.allocation.update({
    where: { id },
    data: {
      ...(disabled !== undefined ? { disabled } : {}),
      ...(alias !== undefined ? { alias } : {}),
    },
    include: {
      node: { select: { id: true, name: true } },
      server: { select: { id: true, name: true } },
    }
  });

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "ALLOCATION_UPDATED",
    targetId: id,
    ipAddress: getIpFromRequest(request),
    metadata: { port: alloc.port, disabled: updated.disabled, alias: updated.alias },
  });

  return NextResponse.json({ allocation: updated });
}

export async function DELETE(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.ALLOCATIONS_DELETE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const alloc = await db.allocation.findUnique({ where: { id } });
  if (!alloc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (alloc.assigned) return NextResponse.json({ error: "Cannot delete an assigned allocation" }, { status: 409 });

  await db.allocation.delete({ where: { id } });
  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "ALLOCATION_DELETED", targetId: id,
    ipAddress: getIpFromRequest(request),
    metadata: { ip: alloc.ip, port: alloc.port },
  });
  return NextResponse.json({ success: true });
}
