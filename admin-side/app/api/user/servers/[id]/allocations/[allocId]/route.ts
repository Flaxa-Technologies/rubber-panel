import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
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
        include: { allocations: { orderBy: { port: "asc" } } },
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

    // Do not allow deleting the only port on a server
    if (server.allocations.length <= 1) {
      return NextResponse.json({ error: "Cannot release the primary connection port of an instance." }, { status: 400 });
    }

    // Free the allocation
    await db.allocation.update({
      where: { id: allocId },
      data: {
        assigned: false,
        serverId: null,
      },
    });

    await createAuditLog({
      actorId: userId,
      actorEmail: user?.email || "user",
      action: "SERVER_UPDATED" as any,
      target: server.name,
      targetId: server.id,
      metadata: {
        action: "PORT_RELEASED_TO_QUOTA",
        port: targetAlloc.port,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Port ${targetAlloc.port} released back to your quota pool!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to release port" }, { status: 500 });
  }
}
