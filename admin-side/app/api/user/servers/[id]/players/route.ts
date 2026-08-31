import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";
import { getNodeBaseUrl } from "@/lib/node-client";
import db from "@/lib/db";

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { internalSecret, expectedSecret, userId } = getAuthHeaders(req);

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const access = await verifyServerAccess(id, userId, "control.console");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const server = await db.server.findUnique({
      where: { id },
      include: { node: true },
    });

    if (!server || !server.node) {
      return NextResponse.json({ error: "Server or node not found" }, { status: 404 });
    }

    // Non-Minecraft servers (Code Sandbox, Python, Node.js) don't have Minecraft player lists
    if (server.isSandbox || server.serverType !== "MINECRAFT") {
      return NextResponse.json({ players: [], total: 0 });
    }

    const baseUrl = getNodeBaseUrl(server.node);
    const nodeRes = await fetch(`${baseUrl}/api/agent/servers/${id}/players`, {
      headers: {
        Authorization: `Bearer ${server.node.authToken}`,
      },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (!nodeRes || !nodeRes.ok) {
      return NextResponse.json({ players: [], total: 0 });
    }

    const data = await nodeRes.json().catch(() => ({ players: [], total: 0 }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ players: [], total: 0 });
  }
}
