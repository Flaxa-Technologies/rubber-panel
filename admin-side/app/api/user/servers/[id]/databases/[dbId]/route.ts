import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { db } from "@/lib/db";
import { rotateDatabasePassword, deleteServerDatabase } from "@/lib/mysql-service";

async function verifyServerAccess(serverId: string, userId: string, isAdmin: boolean) {
  const server = await db.server.findUnique({
    where: { id: serverId },
    include: {
      subusers: true,
    },
  });

  if (!server) return null;
  if (isAdmin || server.ownerId === userId) return server;

  const sub = server.subusers.find((s: any) => s.userId === userId);
  if (sub) {
    try {
      const perms: string[] = JSON.parse(sub.permissions || "[]");
      if (perms.includes("database.*") || perms.includes("*")) {
        return server;
      }
    } catch {}
  }
  return null;
}

// PATCH /api/user/servers/[id]/databases/[dbId] — Rotate password
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dbId } = await params;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const server = await verifyServerAccess(id, user.id, isAdmin);

  if (!server) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const updated = await rotateDatabasePassword(dbId);
    return NextResponse.json({ success: true, database: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to rotate password" }, { status: 400 });
  }
}

// DELETE /api/user/servers/[id]/databases/[dbId] — Delete database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dbId } = await params;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const server = await verifyServerAccess(id, user.id, isAdmin);

  if (!server) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    await deleteServerDatabase(dbId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete database" }, { status: 400 });
  }
}
