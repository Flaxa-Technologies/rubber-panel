import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { db } from "@/lib/db";
import { testMysqlConnection } from "@/lib/mysql-service";

// PATCH /api/admin/databases/[id] — Update host
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.host !== undefined) data.host = String(body.host).trim();
    if (body.port !== undefined) data.port = parseInt(body.port, 10) || 3306;
    if (body.username !== undefined) data.username = String(body.username).trim();
    if (body.password !== undefined) data.password = String(body.password);
    if (body.nodeId !== undefined) data.nodeId = body.nodeId ? String(body.nodeId) : null;

    const updated = await db.databaseHost.update({
      where: { id },
      data,
      include: {
        node: {
          select: { id: true, name: true, fqdn: true },
        },
      },
    });

    const testRes = await testMysqlConnection({
      host: updated.host,
      port: updated.port,
      user: updated.username,
      password: updated.password,
    });

    return NextResponse.json({ success: true, host: updated, testResult: testRes });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update host" }, { status: 400 });
  }
}

// DELETE /api/admin/databases/[id] — Delete host
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await db.databaseHost.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete host" }, { status: 400 });
  }
}

// PUT /api/admin/databases/[id] — Test host connection
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role: string } | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const host = await db.databaseHost.findUnique({
    where: { id },
  });

  if (!host) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  const res = await testMysqlConnection({
    host: host.host,
    port: host.port,
    user: host.username,
    password: host.password,
  });

  return NextResponse.json(res);
}
