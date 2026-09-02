import { NextRequest, NextResponse } from "next/server";
import { verifyNodeToken, processNodeHeartbeat } from "@/lib/node-client";
import { getSetting } from "@/lib/settings";
import db from "@/lib/db";

// POST /api/node/heartbeat — Called by node agents to report their status
export async function POST(request: NextRequest) {
  const node = await verifyNodeToken(request);
  if (!node) {
    return NextResponse.json({ error: "Invalid node token" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cpuUsage = 0,
    ramUsage = 0,
    diskUsage = 0,
    hostTotalRam,
    hostUsedRam,
    hostTotalDisk,
    hostUsedDisk,
    serversUsedDisk,
    serversUsedRam,
    networkRx = 0,
    networkTx = 0,
    agentVersion = "unknown",
    serverStatuses = [],
    radar,
  } = body;

  await processNodeHeartbeat(node.nodeId, {
    cpuUsage,
    ramUsage,
    diskUsage,
    hostTotalRam,
    hostUsedRam,
    hostTotalDisk,
    hostUsedDisk,
    serversUsedDisk,
    serversUsedRam,
    networkRx,
    networkTx,
    agentVersion,
    serverStatuses,
  });

  // Persist Radar sample if sent
  if (radar) {
    db.radarSample.create({
      data: {
        nodeId: node.nodeId,
        connsPerSec: radar.connsPerSec || 0,
        bytesPerSecIn: radar.bytesPerSecIn || 0,
        bytesPerSecOut: radar.bytesPerSecOut || 0,
        activeBans: radar.activeBans || 0,
      },
    }).catch(() => {});

    // Sync any active bans reported by node daemon into db.radarBan
    if (Array.isArray(radar.activeBansList) && radar.activeBansList.length > 0) {
      for (const ban of radar.activeBansList) {
        if (ban.ip) {
          const cleanIp = String(ban.ip).trim();
          db.radarBan.findFirst({
            where: { ip: cleanIp, releasedAt: null },
          }).then(async (existing) => {
            if (existing) {
              await db.radarBan.update({
                where: { id: existing.id },
                data: {
                  expiresAt: new Date(ban.expiresAt || Date.now() + 15 * 60 * 1000),
                  reason: ban.reason || "Exceeded connection rate limit",
                },
              });
            } else {
              await db.radarBan.create({
                data: {
                  ip: cleanIp,
                  nodeId: node.nodeId,
                  port: ban.port,
                  serverId: ban.serverId,
                  reason: ban.reason || "Exceeded connection rate limit",
                  country: ban.country || "UN",
                  expiresAt: new Date(ban.expiresAt || Date.now() + 15 * 60 * 1000),
                },
              });
            }
          }).catch(() => {});
        }
      }
    }

    // Prune samples older than 24h (probabilistic 5% chance on heartbeat)
    if (Math.random() < 0.05) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      db.radarSample.deleteMany({
        where: { timestamp: { lt: oneDayAgo } },
      }).catch(() => {});
    }
  }

  // Fetch Radar configuration (trusted IPs & thresholds)
  const trustedIpsList = await db.trustedIp.findMany({ select: { ip: true } });
  const radarThresholdsList = await db.radarThreshold.findMany();
  const fleetShieldMode = (await getSetting("radar.fleetShieldMode")) === "true";

  const thresholdsMap: Record<string, any> = {};
  for (const t of radarThresholdsList) {
    if (t.serverId) {
      thresholdsMap[t.serverId] = {
        serverId: t.serverId,
        maxConnPerIpPerWindow: t.maxConnPerIpPerWindow,
        windowMs: t.windowMs,
        banDurationMs: t.banDurationMs,
        autoMitigate: t.autoMitigate,
        underAttackMode: t.underAttackMode,
      };
    }
  }

  const dbNode = await db.node.findUnique({
    where: { id: node.nodeId },
    select: {
      autoStartServersOnBoot: true,
      bootCryoSleepMode: true,
      bootGracePeriodSeconds: true,
      maxConcurrentBootStarts: true,
      bootStartupDelaySeconds: true,
    },
  });

  const nodeServers = await db.server.findMany({
    where: { nodeId: node.nodeId },
    select: {
      id: true,
      name: true,
      serverType: true,
      internalPort: true,
      cryoSleepEnabled: true,
      cryoSleepIdleMinutes: true,
      cryoSleepMotd: true,
      allocations: { select: { port: true }, take: 1 },
    },
  });

  const defaultCryoEnabled = (await getSetting("cryosleep.defaultEnabled")) === "true";
  const defaultIdleMinutes = parseInt((await getSetting("cryosleep.defaultIdleMinutes")) || "10");
  const defaultMotd = (await getSetting("cryosleep.defaultMotd")) || "§bRubber Panel §8| §3Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!";
  const wakeMessage = (await getSetting("cryosleep.wakeMessage")) || "§b§lRubber Panel §8— §3§lCRYO-SLEEP WAKE-UP\\n\\n§aServer wake sequence initiated!\\n§7The instance is now booting from hibernation.\\n\\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)";

  // Check if there is a pending update queued for this node
  const pendingUpdateRecord = await db.updateRecord.findFirst({
    where: {
      side: { in: [`node:${node.nodeId}`, "node"] },
      status: { in: ["DOWNLOADING", "APPLYING", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const clean = (v: string) => (v || "").replace(/^v/, "").trim();
  let pendingUpdate = null;

  if (pendingUpdateRecord) {
    if (clean(agentVersion) === clean(pendingUpdateRecord.version)) {
      // Node has completed the update! Mark as SUCCESS.
      await db.updateRecord.update({
        where: { id: pendingUpdateRecord.id },
        data: { status: "SUCCESS", appliedAt: new Date() },
      }).catch(() => {});
    } else {
      pendingUpdate = {
        version: pendingUpdateRecord.version,
        assetUrl: pendingUpdateRecord.assetUrl,
      };
    }
  }

  return NextResponse.json({ 
    success: true, 
    nodeId: node.nodeId,
    timestamp: new Date().toISOString(),
    pendingUpdate,
    config: {
      radar: {
        trustedIps: trustedIpsList.map((t) => t.ip),
        thresholds: thresholdsMap,
        shieldMode: fleetShieldMode,
      },
      cryosleep: {
        defaultEnabled: defaultCryoEnabled,
        defaultIdleMinutes,
        defaultMotd,
        wakeMessage,
      },
      bootPolicy: {
        autoStartServersOnBoot: dbNode?.autoStartServersOnBoot ?? false,
        bootCryoSleepMode: dbNode?.bootCryoSleepMode ?? "CRYO_HIBERNATE_ALL",
        bootGracePeriodSeconds: dbNode?.bootGracePeriodSeconds ?? 15,
        maxConcurrentBootStarts: dbNode?.maxConcurrentBootStarts ?? 3,
        bootStartupDelaySeconds: dbNode?.bootStartupDelaySeconds ?? 5,
      },
      servers: nodeServers.map((s) => ({
        id: s.id,
        name: s.name,
        serverType: s.serverType,
        port: s.allocations[0]?.port ?? s.internalPort ?? 25565,
        cryoSleepEnabled: s.cryoSleepEnabled,
        cryoSleepIdleMinutes: s.cryoSleepIdleMinutes,
        cryoSleepMotd: s.cryoSleepMotd,
      })),
    },
  });
}

// GET /api/node/heartbeat — Health check for nodes
export async function GET(request: NextRequest) {
  const node = await verifyNodeToken(request);
  if (!node) {
    return NextResponse.json({ error: "Invalid node token" }, { status: 401 });
  }

  return NextResponse.json({ 
    success: true, 
    message: "Admin panel is reachable",
    timestamp: new Date().toISOString(),
  });
}
