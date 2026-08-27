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
  const { cpuUsage = 0, ramUsage = 0, diskUsage = 0, networkRx = 0, networkTx = 0, agentVersion = "unknown", serverStatuses = [] } = body;

  await processNodeHeartbeat(node.nodeId, {
    cpuUsage,
    ramUsage,
    diskUsage,
    networkRx,
    networkTx,
    agentVersion,
    serverStatuses,
  });

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

  return NextResponse.json({ 
    success: true, 
    nodeId: node.nodeId,
    timestamp: new Date().toISOString(),
    pendingUpdate: pendingUpdateRecord ? {
      version: pendingUpdateRecord.version,
      assetUrl: pendingUpdateRecord.assetUrl,
    } : null,
    config: {
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
