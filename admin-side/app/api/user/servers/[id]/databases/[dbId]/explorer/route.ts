import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { db } from "@/lib/db";
import {
  getDatabaseTables,
  getTableDataAndSchema,
  executeSqlOnDatabase,
} from "@/lib/mysql-service";

async function getAuthenticatedUser(request: NextRequest): Promise<{ userId: string; isAdmin: boolean } | null> {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const headerUserId = request.headers.get("x-user-id");

  if (expectedSecret && internalSecret === expectedSecret && headerUserId) {
    const u = await db.user.findUnique({
      where: { id: headerUserId },
      select: { id: true, role: true },
    });
    if (u) {
      return { userId: u.id, isAdmin: u.role === "ADMIN" || u.role === "SUPER_ADMIN" };
    }
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role: string } | undefined;
  if (user) {
    return { userId: user.id, isAdmin: user.role === "ADMIN" || user.role === "SUPER_ADMIN" };
  }

  return null;
}

async function verifyServerAndDb(serverId: string, dbId: string, userId: string, isAdmin: boolean) {
  const server = await db.server.findUnique({
    where: { id: serverId },
    include: {
      subusers: true,
      databases: {
        where: { id: dbId },
      },
    },
  });

  if (!server) return null;
  const database = server.databases[0];
  if (!database) return null;

  if (isAdmin || server.ownerId === userId) return { server, database };

  const sub = server.subusers.find((s: any) => s.userId === userId);
  if (sub) {
    try {
      const perms: string[] = JSON.parse(sub.permissions || "[]");
      if (perms.includes("database.*") || perms.includes("*")) {
        return { server, database };
      }
    } catch {}
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dbId } = await params;
  const context = await verifyServerAndDb(id, dbId, auth.userId, auth.isAdmin);

  if (!context) {
    return NextResponse.json({ error: "Database not found or access denied" }, { status: 404 });
  }

  const { database } = context;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "tables";

  try {
    if (action === "tables") {
      const res = await getDatabaseTables(database.name);
      return NextResponse.json(res);
    }

    if (action === "data") {
      const tableName = searchParams.get("table");
      if (!tableName) {
        return NextResponse.json({ error: "table is required for action=data" }, { status: 400 });
      }
      const page = parseInt(searchParams.get("page") || "1", 10) || 1;
      const limit = parseInt(searchParams.get("limit") || "50", 10) || 50;

      const res = await getTableDataAndSchema(database.name, tableName, page, limit);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Explorer operation failed" }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dbId } = await params;
  const context = await verifyServerAndDb(id, dbId, auth.userId, auth.isAdmin);

  if (!context) {
    return NextResponse.json({ error: "Database not found or access denied" }, { status: 404 });
  }

  const { database } = context;

  try {
    const body = await request.json();
    const query = String(body.query || "").trim();

    if (!query) {
      return NextResponse.json({ error: "SQL query cannot be empty" }, { status: 400 });
    }

    const res = await executeSqlOnDatabase(database.name, query);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "SQL Execution failed" }, { status: 400 });
  }
}
