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

const thresholdSchema = z.object({
  serverId: z.string().optional(),
  nodeId: z.string().optional(),
  maxConnPerIpPerWindow: z.number().min(1).max(500),
  windowMs: z.number().min(1000).max(60000),
  banDurationMs: z.number().min(10000).max(86400000),
  autoMitigate: z.boolean(),
});

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const thresholds = await db.radarThreshold.findMany();
    return NextResponse.json({ thresholds });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch thresholds" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = thresholdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { serverId, nodeId, maxConnPerIpPerWindow, windowMs, banDurationMs, autoMitigate } = parsed.data;

    let threshold;
    if (serverId) {
      threshold = await db.radarThreshold.upsert({
        where: { serverId },
        update: { maxConnPerIpPerWindow, windowMs, banDurationMs, autoMitigate, nodeId },
        create: { serverId, nodeId, maxConnPerIpPerWindow, windowMs, banDurationMs, autoMitigate },
      });
    } else {
      // Global threshold
      const existing = await db.radarThreshold.findFirst({ where: { serverId: null } });
      if (existing) {
        threshold = await db.radarThreshold.update({
          where: { id: existing.id },
          data: { maxConnPerIpPerWindow, windowMs, banDurationMs, autoMitigate, nodeId },
        });
      } else {
        threshold = await db.radarThreshold.create({
          data: { serverId: null, nodeId, maxConnPerIpPerWindow, windowMs, banDurationMs, autoMitigate },
        });
      }
    }

    // Sync to nodes
    const allThresholds = await db.radarThreshold.findMany();
    const thresholdsMap: Record<string, any> = {};
    for (const t of allThresholds) {
      if (t.serverId) {
        thresholdsMap[t.serverId] = t;
      }
    }
    const nodes = await db.node.findMany({ where: { status: "ONLINE" } });
    for (const n of nodes) {
      sendNodeCommand(n.id, "/api/agent/radar/action", "POST", {
        action: "sync_thresholds",
        thresholds: thresholdsMap,
      }).catch(() => {});
    }

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "RADAR_THRESHOLD_UPDATED",
      target: serverId ? `Server:${serverId}` : "GLOBAL",
      targetId: threshold.id,
      ipAddress: getIpFromRequest(request),
      metadata: { maxConnPerIpPerWindow, windowMs, banDurationMs, autoMitigate },
    });

    return NextResponse.json({ success: true, threshold });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
