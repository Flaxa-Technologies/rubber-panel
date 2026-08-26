import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string }> };
type Actor = { id: string; email: string; role: string };

// GET /api/admin/servers/[id]/cryosleep — Check real-time wake proxy status on node
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as Actor;
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, cryoSleepEnabled: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/cryosleep`, "GET");
  return NextResponse.json(result.data || { isSleeping: false, status: "OFFLINE" });
}

// POST /api/admin/servers/[id]/cryosleep — Action: "wake" | "hibernate" | "config"
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as Actor;
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "hibernate";

  const server = await db.server.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const port = server.allocations[0]?.port ?? server.internalPort ?? 25565;

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/cryosleep`, "POST", {
    action,
    name: server.name,
    port,
    serverType: server.serverType,
    enabled: body.enabled !== undefined ? body.enabled : server.cryoSleepEnabled,
    idleMinutes: body.idleMinutes !== undefined ? body.idleMinutes : server.cryoSleepIdleMinutes,
    motd: body.motd !== undefined ? body.motd : server.cryoSleepMotd,
    wakeMessage: body.wakeMessage,
  });

  return NextResponse.json(result.data || { success: result.success, error: result.error });
}
