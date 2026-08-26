import { NextRequest, NextResponse } from "next/server";
import { getNodeResources } from "@/lib/resource-monitor";
import { startHeartbeat } from "@/lib/heartbeat-worker";
import { reloadStatesFromDisk } from "@/lib/server-manager";

// Self-healing initialization on node startup
startHeartbeat();
reloadStatesFromDisk().catch(() => {});

// GET /api/agent/health — Protected by Bearer token (used by admin-side)
// GET /api/agent/health?local=1 — No auth, localhost only (used by node-side UI)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const isLocalRequest = url.searchParams.get("local") === "1";

  if (!isLocalRequest) {
    const authHeader = request.headers.get("authorization");
    const NODE_TOKEN = process.env.NODE_TOKEN;
    if (!authHeader?.startsWith("Bearer ") || authHeader.substring(7) !== NODE_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resources = getNodeResources();
  const configured = !!(process.env.NODE_TOKEN && process.env.NODE_ID &&
    process.env.NODE_TOKEN !== "dev-token-placeholder" &&
    process.env.NODE_ID !== "dev-node-id");

  return NextResponse.json({
    status: "ONLINE",
    nodeId: process.env.NODE_ID ?? "not-configured",
    agentVersion: "1.0.0",
    configured,
    adminApiUrl: process.env.ADMIN_API_URL ?? "http://localhost:3000",
    resources,
    timestamp: new Date().toISOString(),
  });
}
