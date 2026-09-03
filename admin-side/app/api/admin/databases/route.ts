import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { db } from "@/lib/db";
import { testMysqlConnection } from "@/lib/mysql-service";

// GET /api/admin/databases — List all database hosts, nodes, and all server databases
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [hosts, nodes, databases] = await Promise.all([
    db.databaseHost.findMany({
      include: {
        node: {
          select: { id: true, name: true, fqdn: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.node.findMany({
      select: { id: true, name: true, fqdn: true },
      orderBy: { name: "asc" },
    }),
    db.serverDatabase.findMany({
      include: {
        server: {
          select: { id: true, name: true, ownerId: true, node: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    hosts,
    nodes,
    databases,
  });
}

// POST /api/admin/databases — Create a new database host
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "MySQL Host").trim();
    const hostAddr = String(body.host || "127.0.0.1").trim();
    const port = parseInt(body.port || "3306", 10) || 3306;
    const username = String(body.username || "root").trim();
    const password = String(body.password || "");
    const nodeId = body.nodeId ? String(body.nodeId) : null;

    const testRes = await testMysqlConnection({
      host: hostAddr,
      port,
      user: username,
      password,
    });

    const host = await db.databaseHost.create({
      data: {
        name,
        host: hostAddr,
        port,
        username,
        password,
        nodeId,
      },
      include: {
        node: {
          select: { id: true, name: true, fqdn: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      host,
      testResult: testRes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create database host" }, { status: 400 });
  }
}
