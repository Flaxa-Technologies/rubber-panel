import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, unauthorizedResponse } from "@/lib/auth";
import { getLocalPumpkinBuilds, installPumpkinBinaryOnNode } from "@/lib/pumpkin-agent";

// GET /api/agent/software/pumpkin — Return list of cached Pumpkin builds on this node
export async function GET(request: NextRequest) {
  if (!verifyAgentToken(request)) return unauthorizedResponse();

  const builds = await getLocalPumpkinBuilds();
  return NextResponse.json({
    success: true,
    builds,
    arch: process.arch,
    platform: process.platform,
  });
}

// POST /api/agent/software/pumpkin — Sync and install a Pumpkin build on this node
export async function POST(request: NextRequest) {
  if (!verifyAgentToken(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const result = await installPumpkinBinaryOnNode(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to install Pumpkin binary" }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Install failed" }, { status: 500 });
  }
}
