import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function verifyInternalSecret(request: NextRequest): string | null {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  if (!expectedSecret || internalSecret !== expectedSecret || !userId) return null;
  return userId;
}

// GET /api/user/servers/[id]/stats — Return real-time CPU, RAM, Disk & Network telemetry
export async function GET(request: NextRequest, context: RouteContext) {
  const userId = verifyInternalSecret(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const access = await verifyServerAccess(id, userId);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true, status: true, ram: true, cpu: true, disk: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "This instance is suspended." }, { status: 403 });
  }

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/stats`, "GET");
  if (!result.success) {
    return NextResponse.json({
      id: server.id,
      status: server.status,
      cpuUsage: 0,
      cpuLimit: server.cpu,
      ramUsageMb: 0,
      ramLimitMb: server.ram,
      ramPercent: 0,
      diskUsedMb: 0,
      diskLimitMb: server.disk,
      diskPercent: 0,
      netRx: "0 B",
      netTx: "0 B",
      isCryoSleeping: false,
    });
  }

  return NextResponse.json(result.data);
}
