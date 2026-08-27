import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { startServer, stopServer, restartServer, deleteServer, getServerStatus, updateServerInfo } from "@/lib/server-manager";

// GET /api/agent/servers/[id] — Get server status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const info = await getServerStatus(id);
  if (!info) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  return NextResponse.json(info);
}

// POST /api/agent/servers/[id] — Power action
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  let result: { success: boolean; error?: string };

  switch (action) {
    case "start":
      result = await startServer(id);
      break;
    case "stop":
      result = await stopServer(id, body.force ?? false);
      break;
    case "restart":
      result = await restartServer(id);
      break;
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, action });
}

// PATCH /api/agent/servers/[id] — Update server configuration
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const result = await updateServerInfo(id, body);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}

// DELETE /api/agent/servers/[id] — Delete server
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteServer(id);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
