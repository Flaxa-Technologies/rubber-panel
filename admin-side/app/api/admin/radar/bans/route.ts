import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";
import { lookupCountry } from "@/lib/geoip";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

const banSchema = z.object({
  ip: z.string().min(3).max(45),
  nodeId: z.string().optional(),
  serverId: z.string().optional(),
  reason: z.string().min(1, "Ban reason is required"),
  durationMinutes: z.number().min(1).max(525600).default(60), // Default 1 hour
});

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const bans = await db.radarBan.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const enriched = bans.map((b) => {
      let country = b.country;
      if (!country || country === "UN") {
        const geo = lookupCountry(b.ip);
        if (geo?.code) country = geo.code;
      }
      return { ...b, country: country || "UN" };
    });

    return NextResponse.json({ bans: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch bans" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SERVERS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = banSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const cleanIp = parsed.data.ip.trim();

    // Check trusted IPs
    const trusted = await db.trustedIp.findUnique({ where: { ip: cleanIp } });
    if (trusted) {
      return NextResponse.json(
        { error: `Cannot ban ${cleanIp}: This IP is on the Trusted Whitelist.` },
        { status: 400 }
      );
    }

    const durationMs = parsed.data.durationMinutes * 60 * 1000;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMs);

    const geo = lookupCountry(cleanIp);
    const country = geo?.code || "UN";

    // Broadcast ban to target node(s)
    let targetNodeId = parsed.data.nodeId;
    if (targetNodeId) {
      await sendNodeCommand(targetNodeId, "/api/agent/radar/action", "POST", {
        action: "ban",
        ip: cleanIp,
        reason: parsed.data.reason,
        durationMs,
        serverId: parsed.data.serverId,
      }).catch((e) => console.warn(`Failed to push ban to node ${targetNodeId}:`, e.message));
    } else {
      // Fleet-wide broadcast to all online nodes
      const nodes = await db.node.findMany({ where: { status: "ONLINE" } });
      targetNodeId = nodes[0]?.id || "ALL_NODES";
      for (const n of nodes) {
        sendNodeCommand(n.id, "/api/agent/radar/action", "POST", {
          action: "ban",
          ip: cleanIp,
          reason: parsed.data.reason,
          durationMs,
          serverId: parsed.data.serverId,
        }).catch(() => {});
      }
    }

    const ban = await db.radarBan.create({
      data: {
        nodeId: targetNodeId,
        serverId: parsed.data.serverId || null,
        ip: cleanIp,
        reason: parsed.data.reason,
        country,
        createdAt: now,
        expiresAt,
        manual: true,
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "RADAR_BAN_CREATED",
      target: cleanIp,
      targetId: ban.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        ip: cleanIp,
        reason: parsed.data.reason,
        expiresAt: expiresAt.toISOString(),
        nodeId: targetNodeId,
      },
    });

    return NextResponse.json({ success: true, ban }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
