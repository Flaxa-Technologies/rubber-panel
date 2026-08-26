import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { getConsoleLogs, sendConsoleCommand } from "@/lib/server-manager";

// GET /api/agent/servers/[id]/console — Return buffered logs
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const since = parseInt(request.nextUrl.searchParams.get("since") ?? "0");
  const lines = getConsoleLogs(id);
  const slice = since > 0 ? lines.slice(since) : lines;
  return NextResponse.json({ lines: slice, total: lines.length });
}

// POST /api/agent/servers/[id]/console — Send a command
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const command = body.command as string;
  if (!command?.trim()) return NextResponse.json({ error: "No command provided" }, { status: 400 });
  const result = await sendConsoleCommand(id, command.trim());
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
