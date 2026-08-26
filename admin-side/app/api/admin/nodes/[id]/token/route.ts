import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { generateNodeToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const node = await db.node.findUnique({ where: { id } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const authToken = await generateNodeToken();
  await db.node.update({ where: { id }, data: { authToken, status: "OFFLINE", lastHeartbeat: null } });

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "NODE_TOKEN_REGENERATED",
    target: node.name, targetId: node.id,
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({ token: authToken, nodeId: node.id });
}
