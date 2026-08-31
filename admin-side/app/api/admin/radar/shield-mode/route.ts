import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const enabled = Boolean(body.enabled);

    await setSetting("radar.fleetShieldMode", enabled ? "true" : "false", "radar");

    // Broadcast to all online nodes
    const nodes = await db.node.findMany({ where: { status: "ONLINE" } });
    for (const n of nodes) {
      sendNodeCommand(n.id, "/api/agent/radar/action", "POST", {
        action: "shield_mode",
        enabled,
      }).catch(() => {});
    }

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "RADAR_SHIELD_MODE_TOGGLED",
      target: "FLEET",
      ipAddress: getIpFromRequest(request),
      metadata: { enabled },
    });

    return NextResponse.json({
      success: true,
      shieldMode: enabled,
      message: enabled
        ? "Fleet-wide Shield Mode ACTIVATED. All nodes are now applying stricter connection rate limits."
        : "Fleet-wide Shield Mode DEACTIVATED.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to toggle shield mode" }, { status: 500 });
  }
}
