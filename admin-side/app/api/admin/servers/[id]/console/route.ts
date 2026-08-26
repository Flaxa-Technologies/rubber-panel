import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { sendNodeCommand } from "@/lib/node-client";

// GET /api/admin/servers/[id]/console — Proxy to node console logs
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const since = request.nextUrl.searchParams.get("since") ?? "0";

  const server = await db.server.findUnique({ where: { id }, select: { nodeId: true } });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/console?since=${since}`, "GET");
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 503 });
  return NextResponse.json(result.data);
}

// POST /api/admin/servers/[id]/console — Send command via node
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();

  const server = await db.server.findUnique({ where: { id }, select: { nodeId: true } });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/console`, "POST", { command: body.command });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
