import { NextRequest, NextResponse } from "next/server";
import { getNodeResources } from "@/lib/resource-monitor";
import { getDiscoveredNodeId } from "@/lib/heartbeat-worker";
import { verifyAgentToken, verifyAgentTokenAsync } from "@/lib/auth";

// GET /api/agent/health — Protected by Bearer token (used by admin-side)
// GET /api/agent/health?local=1 — No auth, localhost only (used by node-side UI)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const isLocalRequest = url.searchParams.get("local") === "1";

  if (!isLocalRequest) {
    if (!(await verifyAgentTokenAsync(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resources = getNodeResources();
  const activeId = getDiscoveredNodeId();
  const configured = !!(process.env.NODE_TOKEN && process.env.NODE_TOKEN !== "dev-token-placeholder");

  return NextResponse.json({
    status: "ONLINE",
    nodeId: activeId || process.env.NODE_ID || (configured ? "auto-registered" : "not-configured"),
    agentVersion: "0.1.0-beta.9",
    configured,
    adminApiUrl: process.env.ADMIN_API_URL ?? "http://localhost:3000",
    resources,
    timestamp: new Date().toISOString(),
  });
}
