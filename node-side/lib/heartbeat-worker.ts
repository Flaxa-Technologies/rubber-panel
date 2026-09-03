// heartbeat-worker.ts — Sends periodic heartbeats from the node agent to the admin panel
// Runs in the Node.js server process via instrumentation.ts

import fs from "fs";
import path from "path";
import { getNodeResources } from "./resource-monitor";
import { getAllServers, getServerStatus } from "./server-manager";
import { initCryoSleepEngine, syncBootPolicy, registerCryoServer, hibernateServer } from "./cryo-sleep-engine";
import { isWakeProxyRunning } from "./cryo-sleep-proxy";
import { runNodeUpdate } from "./node-updater";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const NODE_TOKEN = process.env.NODE_TOKEN ?? "";
const INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS ?? "30") * 1000;

declare global {
  var __rubberHeartbeatStarted: boolean | undefined;
}

let discoveredNodeId: string = process.env.NODE_ID ?? "";

export function getDiscoveredNodeId(): string {
  return discoveredNodeId || process.env.NODE_ID || "";
}

export function startHeartbeat() {
  if (globalThis.__rubberHeartbeatStarted) return;
  globalThis.__rubberHeartbeatStarted = true;

  // Ensure Radar telemetry and defense loop is running
  import("./radar-engine").then((m) => m.startRadarLoop()).catch(() => {});

  // Ensure SFTP file transfer server is running on port 2022
  import("./sftp-server").then((m) => m.startSftpServer()).catch(() => {});

  // Don't start if token not configured
  if (!NODE_TOKEN || NODE_TOKEN === "dev-token-placeholder") {
    console.log("[Heartbeat] NODE_TOKEN not set — heartbeat disabled. Configure .env to connect to admin.");
    return;
  }

  console.log(`[Heartbeat] Starting — will ping ${ADMIN_API_URL}/api/node/heartbeat every ${INTERVAL_MS / 1000}s`);

  // Send immediately on startup, then on interval 
  sendHeartbeat();
  setInterval(sendHeartbeat, INTERVAL_MS);
}

async function sendHeartbeat() {
  try {
    const resources = getNodeResources();
    const servers = await getAllServers();
    
    // Verify actual container status for all servers
    for (const s of servers) {
      const refreshed = await getServerStatus(s.id);
      if (refreshed) {
        s.status = refreshed.status;
      }
    }

    let currentVer = "0.1.0-beta.16";
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
      if (pkg?.version) currentVer = pkg.version;
    } catch {}

    const activeId = discoveredNodeId || process.env.NODE_ID || "";
    const { getRadarStats, updateTrustedIps, updateServerThresholds, setFleetShieldMode } = await import("./radar-engine");
    const radarStats = getRadarStats();

    const payload = {
      nodeId: activeId,
      agentVersion: currentVer,
      cpuUsage: resources.cpuUsage,
      ramUsage: resources.ramUsage,
      diskUsage: resources.diskUsage,
      hostTotalRam: resources.ramTotalMb,
      hostUsedRam: resources.ramUsedMb,
      hostTotalDisk: resources.diskTotalMb,
      hostUsedDisk: resources.diskUsedMb,
      serversUsedDisk: resources.serversDiskUsedMb,
      networkRx: radarStats.current.bytesPerSecIn || 0,
      networkTx: radarStats.current.bytesPerSecOut || 0,
      serverStatuses: servers.map(s => ({ id: s.id, status: s.status })),
      radar: {
        connsPerSec: radarStats.current.connsPerSec,
        bytesPerSecIn: radarStats.current.bytesPerSecIn,
        bytesPerSecOut: radarStats.current.bytesPerSecOut,
        activeBans: radarStats.activeBansCount,
        activeBansList: radarStats.activeBansList,
        topOffenders: radarStats.topOffenders.slice(0, 10),
      },
    };

    const adminCandidates = Array.from(new Set([
      ADMIN_API_URL,
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ].filter(Boolean)));

    let res: Response | null = null;
    let lastErr = "";

    for (const targetUrl of adminCandidates) {
      try {
        const candidateRes = await fetch(`${targetUrl}/api/node/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${NODE_TOKEN}`,
            "X-Node-Id": activeId,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RubberPanel/2.0 (Flaxa Studios)",
            "Bypass-Tunnel-Reminder": "true",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3500),
        });

        if (candidateRes.ok) {
          res = candidateRes;
          break;
        } else {
          lastErr = `HTTP ${candidateRes.status}`;
        }
      } catch (e: any) {
        lastErr = e?.message || "Connection failed";
      }
    }

    if (res && res.ok) {
      const data = await res.json();
      if (data?.nodeId && !discoveredNodeId) {
        discoveredNodeId = data.nodeId;
      }
      console.log(`[Heartbeat] ✓ OK (Node: ${discoveredNodeId || "connected"}) — ${new Date().toLocaleTimeString()}`);
      
      try {
        const clean = (v: string) => (v || "").replace(/^v/, "").trim();
        if (data?.pendingUpdate?.version && data?.pendingUpdate?.assetUrl) {
          if (clean(currentVer) !== clean(data.pendingUpdate.version)) {
            runNodeUpdate(data.pendingUpdate.version, data.pendingUpdate.assetUrl).catch(() => {});
          }
        }

        if (data?.config?.radar) {
          if (Array.isArray(data.config.radar.trustedIps)) {
            updateTrustedIps(data.config.radar.trustedIps);
          }
          if (data.config.radar.thresholds) {
            updateServerThresholds(data.config.radar.thresholds);
          }
          if (typeof data.config.radar.shieldMode === "boolean") {
            setFleetShieldMode(data.config.radar.shieldMode);
          }
        }

        if (data?.config?.cryosleep) {
          initCryoSleepEngine(data.config.cryosleep);
        }
        if (data?.config?.bootPolicy) {
          syncBootPolicy(data.config.bootPolicy);
        }
        if (Array.isArray(data?.config?.servers)) {
          for (const s of data.config.servers) {
            registerCryoServer({
              serverId: s.id,
              serverName: s.name,
              serverType: s.serverType,
              port: s.allocations?.[0]?.port ?? s.internalPort,
              enabled: !!s.cryoSleepEnabled,
              idleMinutes: s.cryoSleepIdleMinutes ?? data.config.cryosleep?.defaultIdleMinutes ?? 10,
              motd: s.cryoSleepMotd,
            });
          }
        }
      } catch (innerErr) {
        console.warn("[Heartbeat] Engine sync note:", innerErr);
      }
    } else {
      console.warn(`[Heartbeat] Could not reach admin panel (${adminCandidates.join(", ")}): ${lastErr}`);
    }
  } catch (err: any) {
    console.warn(`[Heartbeat] Heartbeat routine error:`, err.message);
  }
}
