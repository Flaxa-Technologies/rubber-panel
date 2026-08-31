import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import db from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { lookupCountry } from "@/lib/geoip";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const nodes = await db.node.findMany({
      select: {
        id: true,
        name: true,
        fqdn: true,
        status: true,
        networkRx: true,
        networkTx: true,
        lastHeartbeat: true,
      },
    });

    const fleetShieldMode = (await getSetting("radar.fleetShieldMode")) === "true";

    // Fetch recent 15-minute samples aggregated across nodes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const samples = await db.radarSample.findMany({
      where: { timestamp: { gte: fifteenMinAgo } },
      orderBy: { timestamp: "asc" },
    });

    // Use recent samples for responsive live graph curve
    const aggregatedTimeline = samples.slice(-60).map((s) => ({
      timestamp: s.timestamp.toISOString(),
      connsPerSec: s.connsPerSec,
      bytesIn: s.bytesPerSecIn,
      bytesOut: s.bytesPerSecOut,
      activeBans: s.activeBans,
    }));

    // Fetch active bans
    const now = new Date();
    const activeBans = await db.radarBan.findMany({
      where: {
        releasedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Enrich bans with geo country if missing
    const enrichedBans = activeBans.map((b) => {
      let country = b.country;
      if (!country || country === "UN") {
        const geo = lookupCountry(b.ip);
        if (geo?.code) country = geo.code;
      }
      return {
        ...b,
        country: country || "UN",
      };
    });

    // Calculate current fleet metrics
    let totalFleetConnsPerSec = 0;
    let totalFleetBytesIn = 0;
    let totalFleetBytesOut = 0;
    let elevatedNodesCount = 0;

    for (const node of nodes) {
      const rx = node.networkRx || 0;
      const tx = node.networkTx || 0;
      totalFleetBytesIn += rx;
      totalFleetBytesOut += tx;
      if (rx > 10 * 1024 * 1024) { // > 10 MB/s
        elevatedNodesCount++;
      }
    }

    if (aggregatedTimeline.length > 0) {
      const latest = aggregatedTimeline[aggregatedTimeline.length - 1];
      totalFleetConnsPerSec = latest.connsPerSec;
    }

    const trustedCount = await db.trustedIp.count();

    return NextResponse.json({
      fleet: {
        totalNodes: nodes.length,
        onlineNodes: nodes.filter((n) => n.status === "ONLINE").length,
        elevatedNodesCount,
        shieldMode: fleetShieldMode,
        connsPerSec: totalFleetConnsPerSec,
        bytesPerSecIn: totalFleetBytesIn,
        bytesPerSecOut: totalFleetBytesOut,
        activeBansCount: activeBans.length,
        trustedIpsCount: trustedCount,
      },
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        fqdn: n.fqdn,
        status: n.status,
        rx: n.networkRx || 0,
        tx: n.networkTx || 0,
      })),
      timeline: aggregatedTimeline,
      activeBans: enrichedBans,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch radar telemetry" }, { status: 500 });
  }
}
