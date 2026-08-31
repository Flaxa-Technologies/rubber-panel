import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { getServerLiveStats } from "@/lib/server-manager";

// GET /api/agent/servers/[id]/stats — Return real-time live resource telemetry
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const stats = await getServerLiveStats(id);

  if (!stats) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    ...stats,
  });
}
