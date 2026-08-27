import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createSetupToken } from "@/lib/node-setup-tokens";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.NODES_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const node = await db.node.findUnique({
    where: { id },
    select: { id: true, name: true, authToken: true, port: true, fqdn: true },
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const setupToken = createSetupToken({
    nodeId: node.id,
    authToken: node.authToken,
    port: node.port || 3001,
    ttlMinutes: 15,
  });

  return NextResponse.json({
    nodeId: node.id,
    token: node.authToken,
    setupToken,
    port: node.port || 3001,
    name: node.name,
  });
}
