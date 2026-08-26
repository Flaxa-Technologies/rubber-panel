import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: serverId } = await params;
  let userId: string | null = null;

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (internalSecret && internalSecret === expectedSecret) {
    const { searchParams } = new URL(req.url);
    userId = searchParams.get("userId");
  } else {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [server, user, quota] = await Promise.all([
      db.server.findUnique({
        where: { id: serverId },
        include: { node: true, allocations: true },
      }),
      db.user.findUnique({
        where: { id: userId },
        include: { servers: { include: { allocations: true } } },
      }),
      db.userResourceQuota.findUnique({
        where: { userId },
      }),
    ]);

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== userId && user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!quota) {
      return NextResponse.json({ error: "No resource quota assigned to your account." }, { status: 403 });
    }

    if (quota.isSuspended) {
      return NextResponse.json({ error: "Your resource quota pool is suspended." }, { status: 403 });
    }

    // Count extra port allocations currently in use
    let totalUsedAllocations = 0;
    for (const s of (user?.servers || [])) {
      if (s.isCreatedFromQuota) {
        totalUsedAllocations += (s.allocations?.length || 1);
      } else {
        totalUsedAllocations += Math.max(0, (s.allocations?.length || 1) - 1);
      }
    }

    if (totalUsedAllocations >= quota.maxAllocations) {
      return NextResponse.json({
        error: `Port allocation limit reached (${quota.maxAllocations} max). Please release unused ports or contact administrator.`,
      }, { status: 400 });
    }

    // Find an available port on the server's node
    let freeAllocation = await db.allocation.findFirst({
      where: {
        nodeId: server.nodeId,
        assigned: false,
        disabled: false,
        port: { not: 25565 },
      },
      orderBy: { port: "asc" },
    });

    if (!freeAllocation) {
      // Create a new port on the node
      const rangeStart = Math.max(25566, server.node.portRangeStart ?? 25566);
      const rangeEnd = Math.max(rangeStart + 200, server.node.portRangeEnd ?? 29999);
      const usedPorts = await db.allocation.findMany({
        where: { nodeId: server.nodeId },
        select: { port: true },
      });
      const usedSet = new Set(usedPorts.map(p => p.port));
      usedSet.add(25565);

      let nextP = -1;
      for (let p = rangeStart; p <= rangeEnd; p++) {
        if (!usedSet.has(p)) {
          nextP = p;
          break;
        }
      }

      if (nextP === -1) {
        return NextResponse.json({ error: "No available ports remaining on this node." }, { status: 503 });
      }

      freeAllocation = await db.allocation.create({
        data: {
          nodeId: server.nodeId,
          ip: server.node.fqdn,
          port: nextP,
          assigned: false,
          disabled: false,
        },
      });
    }

    // Assign allocation to server
    const updatedAlloc = await db.allocation.update({
      where: { id: freeAllocation.id },
      data: {
        assigned: true,
        serverId: server.id,
      },
    });

    await createAuditLog({
      actorId: userId,
      actorEmail: user?.email || "user",
      action: "SERVER_UPDATED" as any,
      target: server.name,
      targetId: server.id,
      metadata: {
        action: "PORT_ALLOCATED_FROM_QUOTA",
        port: updatedAlloc.port,
        ip: updatedAlloc.ip,
      },
    });

    return NextResponse.json({
      success: true,
      allocation: updatedAlloc,
      message: `Port ${updatedAlloc.port} successfully allocated to "${server.name}" from your quota pool!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to allocate port" }, { status: 500 });
  }
}
