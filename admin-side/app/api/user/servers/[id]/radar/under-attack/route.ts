import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

type UserSession = { id: string; email: string; role: string };

async function resolveUser(request: NextRequest): Promise<UserSession | null> {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id") || request.nextUrl.searchParams.get("userId");

  if (expectedSecret && internalSecret === expectedSecret && userId) {
    const dbUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (dbUser) return dbUser as UserSession;
    return { id: userId, email: "", role: "USER" };
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    return session.user as UserSession;
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: serverId } = await params;
  try {
    const server = await db.server.findUnique({ where: { id: serverId } });
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      // Check subuser permissions
      const subuser = await db.serverSubuser.findUnique({
        where: { serverId_userId: { serverId, userId: user.id } },
      });
      if (!subuser) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      try {
        const perms: string[] = JSON.parse(subuser.permissions || "[]");
        if (!perms.includes("toggleUnderAttackMode") && !perms.includes("admin")) {
          return NextResponse.json({ error: "Missing permission to toggle Under Attack Mode." }, { status: 403 });
        }
      } catch {}
    }

    const body = await request.json();
    const enabled = Boolean(body.enabled);

    // Max 1 hour duration with auto-revert
    const durationMs = Math.min(3600000, Math.max(60000, Number(body.durationMinutes || 60) * 60 * 1000));
    const expiresAt = enabled ? new Date(Date.now() + durationMs) : null;

    const threshold = await db.radarThreshold.upsert({
      where: { serverId },
      update: {
        underAttackMode: enabled,
        underAttackExpiresAt: expiresAt,
      },
      create: {
        serverId,
        nodeId: server.nodeId,
        underAttackMode: enabled,
        underAttackExpiresAt: expiresAt,
        maxConnPerIpPerWindow: 20,
        windowMs: 10000,
        banDurationMs: 900000,
        autoMitigate: true,
      },
    });

    // Push command to node
    await sendNodeCommand(server.nodeId, "/api/agent/radar/action", "POST", {
      action: "under_attack",
      serverId,
      enabled,
      durationMs,
    }).catch(() => {});

    await createAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "RADAR_UNDER_ATTACK_TOGGLED",
      target: server.name,
      targetId: server.id,
      ipAddress: getIpFromRequest(request),
      metadata: { enabled, durationMinutes: Math.round(durationMs / 60000) },
    });

    return NextResponse.json({
      success: true,
      underAttackMode: enabled,
      expiresAt,
      message: enabled
        ? `Under Attack Mode enabled for ${server.name} (stricter connection throttling active for 1 hour).`
        : `Under Attack Mode disabled for ${server.name}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
