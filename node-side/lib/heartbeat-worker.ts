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

function getRuntimeConfig(): { adminUrl: string; nodeToken: string; nodeId: string } {
  let adminUrl = (process.env.ADMIN_API_URL || "").trim();
  let nodeToken = (process.env.NODE_TOKEN || "").trim();
  let nodeId = (process.env.NODE_ID || discoveredNodeId || "").trim();

  const envCandidates = [
    path.join(process.cwd(), ".env"),
    "/var/rubber-panel/node-daemon/.env",
  ];

  for (const envFile of envCandidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ envFile)) {
      try {
        const raw = fs.readFileSync(/*turbopackIgnore: true*/ envFile, "utf-8");
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx === -1) continue;
          const k = trimmed.slice(0, idx).trim();
          let v = trimmed.slice(idx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (k === "ADMIN_API_URL" && v) adminUrl = v;
          if (k === "NODE_TOKEN" && v) nodeToken = v;
          if (k === "NODE_ID" && v) nodeId = v;
        }
      } catch {}
      break;
    }
  }

  if (!adminUrl) adminUrl = "http://localhost:3000";
  return { adminUrl, nodeToken, nodeId };
}

export function startHeartbeat() {
  if (globalThis.__rubberHeartbeatStarted) return;
  globalThis.__rubberHeartbeatStarted = true;

  // Ensure Radar telemetry and defense loop is running
  import("./radar-engine").then((m) => m.startRadarLoop()).catch(() => {});

  // Ensure SFTP file transfer server is running on port 2022
  import("./sftp-server").then((m) => m.startSftpServer()).catch(() => {});

  const { adminUrl, nodeToken } = getRuntimeConfig();
  if (!nodeToken || nodeToken === "dev-token-placeholder") {
    console.log("[Heartbeat] NODE_TOKEN not set — heartbeat disabled. Configure .env to connect to admin.");
    return;
  }

  console.log(`[Heartbeat] Starting — will ping ${adminUrl}/api/node/heartbeat every ${INTERVAL_MS / 1000}s`);

  // Send immediately on startup, then on interval 
  sendHeartbeat();
  setInterval(sendHeartbeat, INTERVAL_MS);
}

async function sendHeartbeat() {
  try {
    const { adminUrl, nodeToken, nodeId } = getRuntimeConfig();
    if (!nodeToken || nodeToken === "dev-token-placeholder") {
      return;
    }

    const resources = getNodeResources();
    const servers = await getAllServers();
    
    // Verify actual container status for all servers
    for (const s of servers) {
      const refreshed = await getServerStatus(s.id);
      if (refreshed) {
        s.status = refreshed.status;
      }
    }

    let currentVer = "0.1.0-beta.75";
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
      if (pkg?.version) currentVer = pkg.version;
    } catch {}

    const activeId = nodeId || discoveredNodeId || process.env.NODE_ID || "";
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

    const isLocalAdmin = adminUrl.includes("localhost") || adminUrl.includes("127.0.0.1");
    const adminCandidates = isLocalAdmin
      ? Array.from(new Set([adminUrl, "http://127.0.0.1:3000", "http://localhost:3000"]))
      : [adminUrl, "http://127.0.0.1:3000"];

    let res: Response | null = null;
    let lastErr = "";

    for (const targetUrl of adminCandidates) {
      try {
        const candidateRes = await fetch(`${targetUrl}/api/node/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nodeToken}`,
            "X-Node-Id": activeId,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RubberPanel/2.0 (Flaxa Studios)",
            "Bypass-Tunnel-Reminder": "true",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        if (candidateRes.ok) {
          res = candidateRes;
          break;
        } else if (candidateRes.status === 401) {
          lastErr = `HTTP 401 Unauthorized (Token Mismatch)`;
          console.error(`[Heartbeat] ✗ Auth Error (401 Unauthorized): NODE_TOKEN in .env does not match Admin Panel for node "${activeId}". Please update .env with the token from Admin Panel -> Nodes -> Setup Link.`);
        } else if (candidateRes.status === 502) {
          lastErr = `HTTP 502 Bad Gateway (Cloudflare Tunnel or Origin port 3000 is unreachable / restarting)`;
        } else if (candidateRes.status === 404) {
          lastErr = `HTTP 404 Not Found`;
          console.warn(`[Heartbeat] ⚠️ HTTP 404 Not Found at ${targetUrl}/api/node/heartbeat. Verify ADMIN_API_URL in .env.`);
        } else {
          lastErr = `HTTP ${candidateRes.status}`;
        }
      } catch (e: any) {
        const cause = e?.cause?.message ? ` (${e.cause.message})` : (e?.cause?.code ? ` (${e.cause.code})` : "");
        lastErr = `${e?.message || "Connection failed"}${cause}`;
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
              port: s.port ?? s.allocations?.[0]?.port ?? s.internalPort ?? 25565,
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
