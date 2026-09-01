import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: serverId } = await params;
  try {
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: {
        node: { select: { id: true, name: true, status: true, networkRx: true, networkTx: true } },
        allocations: { take: 1, select: { port: true } },
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      // Check subuser permission
      const subuser = await db.serverSubuser.findUnique({
        where: { serverId_userId: { serverId, userId: user.id } },
      });
      if (!subuser) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get threshold and under attack status
    const threshold = await db.radarThreshold.findUnique({ where: { serverId } });
    const isUnderAttack = Boolean(threshold?.underAttackMode && threshold?.underAttackExpiresAt && new Date(threshold.underAttackExpiresAt) > new Date());

    // Fetch recent node samples for this server's node
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const samples = await db.radarSample.findMany({
      where: {
        nodeId: server.nodeId,
        timestamp: { gte: fifteenMinAgo },
      },
      orderBy: { timestamp: "asc" },
      take: 60,
    });

    const recentSamples = samples.map((s) => ({
      timestamp: s.timestamp.toISOString(),
      connsPerSec: s.connsPerSec,
      bytesPerSecIn: s.bytesPerSecIn,
    }));

    const latest = samples[samples.length - 1];
    const connsPerSec = latest?.connsPerSec || 0;

    let statusBadge: "ALL_CLEAR" | "ELEVATED" | "UNDER_ATTACK" = "ALL_CLEAR";
    if (isUnderAttack || connsPerSec > 50) {
      statusBadge = "UNDER_ATTACK";
    } else if (connsPerSec > 15) {
      statusBadge = "ELEVATED";
    }

    return NextResponse.json({
      serverId: server.id,
      serverName: server.name,
      connsPerSec,
      statusBadge,
      underAttackMode: isUnderAttack,
      underAttackExpiresAt: threshold?.underAttackExpiresAt || null,
      timeline: recentSamples,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch server radar metrics" }, { status: 500 });
  }
}
