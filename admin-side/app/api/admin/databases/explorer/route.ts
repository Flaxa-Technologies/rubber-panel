import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import {
  getDatabaseTables,
  getTableDataAndSchema,
  executeSqlOnDatabase,
} from "@/lib/mysql-service";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "tables";
  const databaseName = searchParams.get("databaseName");
  const hostId = searchParams.get("hostId") || undefined;

  if (!databaseName) {
    return NextResponse.json({ error: "databaseName is required" }, { status: 400 });
  }

  try {
    if (action === "tables") {
      const res = await getDatabaseTables(databaseName, hostId);
      return NextResponse.json(res);
    }

    if (action === "data") {
      const tableName = searchParams.get("table");
      if (!tableName) {
        return NextResponse.json({ error: "table is required for action=data" }, { status: 400 });
      }
      const page = parseInt(searchParams.get("page") || "1", 10) || 1;
      const limit = parseInt(searchParams.get("limit") || "50", 10) || 50;

      const res = await getTableDataAndSchema(databaseName, tableName, page, limit, hostId);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Explorer operation failed" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const databaseName = String(body.databaseName || "");
    const query = String(body.query || "");
    const hostId = body.hostId ? String(body.hostId) : undefined;

    if (!databaseName || !query) {
      return NextResponse.json({ error: "databaseName and query are required" }, { status: 400 });
    }

    const res = await executeSqlOnDatabase(databaseName, query, hostId);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "SQL Execution failed" }, { status: 400 });
  }
}
