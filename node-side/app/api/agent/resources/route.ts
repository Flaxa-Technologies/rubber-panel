import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { getNodeResources } from "@/lib/resource-monitor";

// GET /api/agent/resources — Node resource stats
export async function GET(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resources = getNodeResources();
  return NextResponse.json(resources);
}
