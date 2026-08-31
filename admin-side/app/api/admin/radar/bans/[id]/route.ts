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
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SERVERS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const ban = await db.radarBan.findUnique({ where: { id } });
    if (!ban) {
      return NextResponse.json({ error: "Ban record not found" }, { status: 404 });
    }

    // Send unban command to node(s)
    if (ban.nodeId && ban.nodeId !== "ALL_NODES") {
      await sendNodeCommand(ban.nodeId, "/api/agent/radar/action", "POST", {
        action: "unban",
        ip: ban.ip,
      }).catch(() => {});
    } else {
      const nodes = await db.node.findMany({ where: { status: "ONLINE" } });
      for (const n of nodes) {
        sendNodeCommand(n.id, "/api/agent/radar/action", "POST", {
          action: "unban",
          ip: ban.ip,
        }).catch(() => {});
      }
    }

    const updated = await db.radarBan.update({
      where: { id },
      data: { releasedAt: new Date() },
    });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "RADAR_BAN_RELEASED",
      target: ban.ip,
      targetId: ban.id,
      ipAddress: getIpFromRequest(request),
      metadata: { ip: ban.ip, nodeId: ban.nodeId },
    });

    return NextResponse.json({
      success: true,
      message: `IP ${ban.ip} unbanned successfully across fleet.`,
      ban: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to release ban" }, { status: 500 });
  }
}
