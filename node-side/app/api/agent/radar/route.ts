import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { getRadarStats } from "@/lib/radar-engine";

// GET /api/agent/radar — Get full radar stats & offender intelligence
export async function GET(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = getRadarStats();
  return NextResponse.json({ success: true, stats });
}
