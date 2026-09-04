import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { reinstallServer, ReinstallOptions } from "@/lib/server-manager";

// POST /api/agent/servers/[id]/reinstall — Reinstall server with file preservation and engine accuracy
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const options: ReinstallOptions = {
    preservePaths: Array.isArray(body.preservePaths) ? body.preservePaths : [],
    softwareType: body.softwareType,
    softwareVersion: body.softwareVersion,
    serverType: body.serverType,
    environment: body.environment,
  };

  const result = await reinstallServer(id, options);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Reinstall failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
