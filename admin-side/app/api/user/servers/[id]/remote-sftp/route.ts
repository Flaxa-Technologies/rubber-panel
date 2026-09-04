import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";
import { sendNodeCommand } from "@/lib/node-client";
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

    const access = await verifyServerAccess(id, userId, "settings.view");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const server = await db.server.findUnique({
      where: { id },
      select: {
        id: true,
        nodeId: true,
        allowRemoteTransfer: true,
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.allowRemoteTransfer === false) {
      return NextResponse.json({
        error: "Remote SFTP pull and transfer is disabled for this server by panel administration.",
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    const endpoint = jobId
      ? `/api/agent/servers/${id}/remote-sftp?jobId=${encodeURIComponent(jobId)}`
      : `/api/agent/servers/${id}/remote-sftp`;

    const result = await sendNodeCommand(server.nodeId, endpoint, "GET");
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to query node agent" }, { status: 502 });
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
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

    const access = await verifyServerAccess(id, userId, "settings.view");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const server = await db.server.findUnique({
      where: { id },
      select: {
        id: true,
        nodeId: true,
        status: true,
        allowRemoteTransfer: true,
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.allowRemoteTransfer === false) {
      return NextResponse.json({
        error: "Remote SFTP pull and transfer is disabled for this server by panel administration.",
      }, { status: 403 });
    }

    const body = await req.json();

    // If pulling, warn or stop if server is currently running
    if (body.action === "pull" && server.status === "RUNNING") {
      // Auto-stop or warn? It's much safer to stop or reject if still running
      if (body.forceStop) {
        await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}`, "POST", { action: "stop" });
      } else {
        return NextResponse.json({
          error: "Server is currently running! Please stop the server before pulling files to prevent file lock corruption.",
          requiresStop: true,
        }, { status: 400 });
      }
    }

    const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/remote-sftp`, "POST", body);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Node agent operation failed" }, { status: 502 });
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
