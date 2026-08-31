import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const trusted = await db.trustedIp.findUnique({ where: { id } });
    if (!trusted) {
      return NextResponse.json({ error: "Trusted IP record not found" }, { status: 404 });
    }

    await db.trustedIp.delete({ where: { id } });

    // Sync to all online nodes
    const allTrusted = await db.trustedIp.findMany({ select: { ip: true } });
    const nodes = await db.node.findMany({ where: { status: "ONLINE" } });
    for (const n of nodes) {
      sendNodeCommand(n.id, "/api/agent/radar/action", "POST", {
        action: "sync_trusted_ips",
        ips: allTrusted.map((t) => t.ip),
      }).catch(() => {});
    }

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "RADAR_TRUSTED_IP_REMOVED",
      target: trusted.ip,
      targetId: trusted.id,
      ipAddress: getIpFromRequest(request),
      metadata: { ip: trusted.ip },
    });

    return NextResponse.json({ success: true, message: `IP ${trusted.ip} removed from trusted list.` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to remove trusted IP" }, { status: 500 });
  }
}
