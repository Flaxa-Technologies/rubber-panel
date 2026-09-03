import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { db } from "@/lib/db";
import { testMysqlConnection } from "@/lib/mysql-service";

// GET /api/admin/database-hosts — Get current MySQL host config
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = await db.databaseHost.findFirst({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    host: host || {
      name: "Primary MySQL Server",
      host: "127.0.0.1",
      port: 3306,
      username: "root",
      password: "",
    },
  });
}

// POST /api/admin/database-hosts — Update or create MySQL host config
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "Primary MySQL Server").trim();
    const hostAddr = String(body.host || "127.0.0.1").trim();
    const port = parseInt(body.port || "3306", 10) || 3306;
    const username = String(body.username || "root").trim();
    const password = String(body.password || "");

    const testRes = await testMysqlConnection({
      host: hostAddr,
      port,
      user: username,
      password,
    });

    const existing = await db.databaseHost.findFirst();
    let saved;
    if (existing) {
      saved = await db.databaseHost.update({
        where: { id: existing.id },
        data: { name, host: hostAddr, port, username, password },
      });
    } else {
      saved = await db.databaseHost.create({
        data: { name, host: hostAddr, port, username, password },
      });
    }

    return NextResponse.json({
      success: true,
      host: saved,
      testResult: testRes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save MySQL host" }, { status: 400 });
  }
}

// PUT /api/admin/database-hosts — Test connection without saving
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const hostAddr = String(body.host || "127.0.0.1").trim();
    const port = parseInt(body.port || "3306", 10) || 3306;
    const username = String(body.username || "root").trim();
    const password = String(body.password || "");

    const testRes = await testMysqlConnection({
      host: hostAddr,
      port,
      user: username,
      password,
    });

    return NextResponse.json(testRes);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Test failed" }, { status: 400 });
  }
}
