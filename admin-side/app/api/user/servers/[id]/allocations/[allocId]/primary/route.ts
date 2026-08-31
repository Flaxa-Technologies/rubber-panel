import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

// POST /api/user/servers/[id]/allocations/[allocId]/primary — Set an allocation as the primary game connection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; allocId: string }> }
) {
  const { id: serverId, allocId } = await params;
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
    const [server, user] = await Promise.all([
      db.server.findUnique({
        where: { id: serverId },
        include: { allocations: { orderBy: { createdAt: "asc" } }, node: true },
      }),
      db.user.findUnique({ where: { id: userId } }),
    ]);

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== userId && user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetAlloc = server.allocations.find((a) => a.id === allocId);
    if (!targetAlloc) {
      return NextResponse.json({ error: "Allocation not found on this server" }, { status: 404 });
    }

    // Set this allocation's createdAt to 10 seconds before the earliest allocation
    const earliest = server.allocations[0]?.createdAt ?? new Date();
    const newCreatedAt = new Date(earliest.getTime() - 10000);

    await db.allocation.update({
      where: { id: allocId },
      data: { createdAt: newCreatedAt },
    });

    // Notify node daemon about the new primary port
    if (server.nodeId) {
      await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "PATCH", {
        port: targetAlloc.port,
      }).catch(() => {});
    }

    await createAuditLog({
      actorId: userId,
      actorEmail: user?.email || "user",
      action: "SERVER_UPDATED" as any,
      target: server.name,
      targetId: server.id,
      metadata: {
        action: "PRIMARY_PORT_CHANGED",
        newPrimaryPort: targetAlloc.port,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Port ${targetAlloc.port} is now the Primary Connection for "${server.name}"! Restart instance to apply.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to set primary port" }, { status: 500 });
  }
}
