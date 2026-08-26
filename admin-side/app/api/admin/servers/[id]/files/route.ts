import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string }> };

async function verifyAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { role: string };
  if (!isAdminRole(user.role)) return null;
  return session.user;
}

// GET /api/admin/servers/[id]/files?path=/
export async function GET(request: NextRequest, context: RouteContext) {
  const actor = await verifyAdmin();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") || "list";
  const filePath = searchParams.get("path") || "/";

  const server = await db.server.findUnique({ where: { id }, select: { nodeId: true } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const result = await sendNodeCommand(
    server.nodeId,
    `/api/agent/servers/${id}/files?action=${action}&path=${encodeURIComponent(filePath)}`,
    "GET"
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data);
}

// POST /api/admin/servers/[id]/files
export async function POST(request: NextRequest, context: RouteContext) {
  const actor = await verifyAdmin();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();

  const server = await db.server.findUnique({ where: { id }, select: { nodeId: true } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const result = await sendNodeCommand(
    server.nodeId,
    `/api/agent/servers/${id}/files`,
    "POST",
    body
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data);
}

// DELETE /api/admin/servers/[id]/files?path=/
export async function DELETE(request: NextRequest, context: RouteContext) {
  const actor = await verifyAdmin();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  const server = await db.server.findUnique({ where: { id }, select: { nodeId: true } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const result = await sendNodeCommand(
    server.nodeId,
    `/api/agent/servers/${id}/files?path=${encodeURIComponent(filePath)}`,
    "DELETE"
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data);
}
