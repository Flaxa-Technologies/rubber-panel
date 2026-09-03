import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { db } from "@/lib/db";
import { createDatabaseForServer } from "@/lib/mysql-service";

async function verifyServerAccess(serverId: string, userId: string, isAdmin: boolean) {
  const server = await db.server.findUnique({
    where: { id: serverId },
    include: {
      subusers: true,
      databases: {
        orderBy: { createdAt: "desc" },
      },
      node: {
        select: { fqdn: true },
      },
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

// GET /api/user/servers/[id]/databases — List databases and quota
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const server = await verifyServerAccess(id, user.id, isAdmin);

  if (!server) {
    return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });
  }

  return NextResponse.json({
    databases: server.databases,
    databaseLimit: server.databaseLimit ?? 0,
    usedCount: server.databases.length,
    nodeHost: server.node?.fqdn || "127.0.0.1",
  });
}

// POST /api/user/servers/[id]/databases — Create a new MySQL database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const server = await verifyServerAccess(id, user.id, isAdmin);

  if (!server) {
    return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const nameSuffix = String(body.name || "db").trim();
    const connectionsFrom = String(body.connectionsFrom || "%").trim();

    const created = await createDatabaseForServer({
      serverId: server.id,
      nameSuffix,
      connectionsFrom,
    });

    return NextResponse.json({ success: true, database: created });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create database" }, { status: 400 });
  }
}
