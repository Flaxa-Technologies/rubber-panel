import { NextRequest } from "next/server";
import db from "./db";
import { getIpFromRequest } from "./audit";

// Verify a node agent request by its auth token
export async function verifyNodeToken(
  request: NextRequest
): Promise<{ nodeId: string; nodeName: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7);
  const node = await db.node.findUnique({
    where: { authToken: token },
    select: { id: true, name: true, status: true },
  });

  if (!node) return null;

  return { nodeId: node.id, nodeName: node.name };
}

// Helper to safely format node agent base URL (supports local IP, FQDN, HTTPS, and GitHub Codespaces tunnels)
export function getNodeBaseUrl(node: { fqdn: string; port: number }): string {
  let host = node.fqdn.trim();
  
  // Check if it's an HTTPS tunnel (like GitHub Codespaces, Cloudflare, ngrok)
  const isTunnelDomain = host.includes(".github.dev") || host.includes(".gitpod.io") || host.includes(".ngrok") || host.includes(".loca.lt") || host.includes(".trycloudflare.com");

  if (isTunnelDomain) {
    if (!host.startsWith("http://") && !host.startsWith("https://")) {
      host = `https://${host}`;
    }
    return host.replace(/\/$/, "");
  }

  if (!host.startsWith("http://") && !host.startsWith("https://")) {
    host = `http://${host}`;
  }

  try {
    const parsed = new URL(host);
    if (!parsed.port && node.port && node.port !== 80 && node.port !== 443) {
      parsed.port = node.port.toString();
    }
    return parsed.origin;
  } catch {
    return `${host}:${node.port}`;
  }
}

// Send a command to a node agent
export async function sendNodeCommand(
  nodeId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
  body?: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const node = await db.node.findUnique({
      where: { id: nodeId },
      select: { fqdn: true, port: true, authToken: true, status: true },
    });

    if (!node) {
      return { success: false, error: "Node not found" };
    }

    if (node.status === "OFFLINE") {
      console.warn(`[NodeClient] Node ${nodeId} is marked OFFLINE in DB but attempting command anyway...`);
    }

    const baseUrl = getNodeBaseUrl(node);
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${node.authToken}`,
        "X-Rubber-Panel": "admin",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Update node heartbeat data
export async function processNodeHeartbeat(
  nodeId: string,
  stats: {
    cpuUsage: number;
    ramUsage: number;
    diskUsage: number;
    networkRx: number;
    networkTx: number;
    agentVersion: string;
    serverStatuses?: Array<{ id: string; status: string }>;
  }
): Promise<void> {
  await db.node.update({
    where: { id: nodeId },
    data: {
      status: "ONLINE",
      lastHeartbeat: new Date(),
      cpuUsage: stats.cpuUsage,
      ramUsage: stats.ramUsage,
      diskUsage: stats.diskUsage,
      networkRx: stats.networkRx,
      networkTx: stats.networkTx,
      agentVersion: stats.agentVersion,
    },
  });

  // Sync server statuses if provided
  if (stats.serverStatuses && stats.serverStatuses.length > 0) {
    // Prisma doesn't have a bulk update for multiple different values easily in SQLite without a loop or raw SQL.
    // For simplicity, we can just use a transaction of updates.
    const updates = stats.serverStatuses.map(s => 
      db.server.updateMany({ // Use updateMany to silently ignore if id doesn't exist
        where: { id: s.id, nodeId: nodeId },
        data: { status: s.status }
      })
    );
    await db.$transaction(updates);
  }
}
