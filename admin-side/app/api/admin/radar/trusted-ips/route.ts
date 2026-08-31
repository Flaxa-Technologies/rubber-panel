import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

const trustedIpSchema = z.object({
  ip: z.string().min(3).max(45),
  label: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const ips = await db.trustedIp.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ trustedIps: ips });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch trusted IPs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = trustedIpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const cleanIp = parsed.data.ip.trim();
    const existing = await db.trustedIp.findUnique({ where: { ip: cleanIp } });
    if (existing) {
      return NextResponse.json({ error: `IP ${cleanIp} is already in the trusted list.` }, { status: 409 });
    }

    const trusted = await db.trustedIp.create({
      data: {
        ip: cleanIp,
        label: parsed.data.label?.trim() || null,
      },
    });

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
      action: "RADAR_TRUSTED_IP_ADDED",
      target: cleanIp,
      targetId: trusted.id,
      ipAddress: getIpFromRequest(request),
      metadata: { ip: cleanIp, label: parsed.data.label },
    });

    return NextResponse.json({ success: true, trustedIp: trusted }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
