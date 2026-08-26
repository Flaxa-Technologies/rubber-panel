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

export async function POST(
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

    const access = await verifyServerAccess(id, userId, "control.command");
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

    const baseUrl = getNodeBaseUrl(server.node);
    const body = await req.json();
    const nodeRes = await fetch(`${baseUrl}/api/agent/servers/${id}/players/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.node.authToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await nodeRes.json();
    return NextResponse.json(data, { status: nodeRes.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to execute player action" }, { status: 500 });
  }
}
