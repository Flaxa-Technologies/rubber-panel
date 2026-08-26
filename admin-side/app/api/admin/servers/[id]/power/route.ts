import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string }> };
type Actor = { id: string; email: string; role: string };

// POST /api/admin/servers/[id]/power — Start/stop/restart
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as Actor;
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action as string;

  if (!["start", "stop", "restart"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, name: true, nodeId: true, suspended: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (server.suspended) return NextResponse.json({ error: "Server is suspended" }, { status: 403 });

  // Send command to node agent
  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "POST", { action });

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: `SERVER_${action.toUpperCase()}` as any, // Typed as any to bypass strict enum check
    target: server.name, targetId: server.id,
    ipAddress: getIpFromRequest(request),
    metadata: { action, nodeResult: result.success },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Node unreachable" }, { status: 503 });
  }

  return NextResponse.json({ success: true, action });
}
