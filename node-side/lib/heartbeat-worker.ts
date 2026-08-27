// heartbeat-worker.ts — Sends periodic heartbeats from the node agent to the admin panel
// Runs in the Node.js server process via instrumentation.ts

import { getNodeResources } from "./resource-monitor";
import { getAllServers } from "./server-manager";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const NODE_TOKEN = process.env.NODE_TOKEN ?? "";
const INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS ?? "30") * 1000;

let started = false;
let discoveredNodeId: string = process.env.NODE_ID ?? "";

export function getDiscoveredNodeId(): string {
  return discoveredNodeId || process.env.NODE_ID || "";
}

export function startHeartbeat() {
  if (started) return;
  started = true;

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
    
    // Periodically verify actual container statuses if they are marked RUNNING
    const { getServerStatus } = await import("./server-manager");
    for (const s of servers) {
      if (s.status === "RUNNING") await getServerStatus(s.id);
    }

    let currentVer = "0.1.0-beta.9";
    try {
      const fs = await import("fs");
      const path = await import("path");
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
      if (pkg?.version) currentVer = pkg.version;
    } catch {}

    const activeId = discoveredNodeId || process.env.NODE_ID || "";

    const payload = {
      nodeId: activeId,
      agentVersion: currentVer,
      cpuUsage: resources.cpuUsage,
      ramUsage: resources.ramUsage,
      diskUsage: 0,
      networkRx: 0,
      networkTx: 0,
      serverStatuses: servers.map(s => ({ id: s.id, status: s.status })),
    };

    const res = await fetch(`${ADMIN_API_URL}/api/node/heartbeat`, {
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
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.nodeId && !discoveredNodeId) {
        discoveredNodeId = data.nodeId;
      }
      console.log(`[Heartbeat] ✓ OK (Node: ${discoveredNodeId || "connected"}) — ${new Date().toLocaleTimeString()}`);
      
      try {
        if (data?.pendingUpdate?.version && data?.pendingUpdate?.assetUrl) {
          const { runNodeUpdate } = await import("./node-updater");
          runNodeUpdate(data.pendingUpdate.version, data.pendingUpdate.assetUrl).catch(() => {});
        }
        if (data?.config?.cryosleep) {
          const { initCryoSleepEngine } = await import("./cryo-sleep-engine");
          initCryoSleepEngine(data.config.cryosleep);
        }
        if (data?.config?.bootPolicy) {
          const { syncBootPolicy } = await import("./cryo-sleep-engine");
          syncBootPolicy(data.config.bootPolicy);
        }
        if (Array.isArray(data?.config?.servers)) {
          const { registerCryoServer, hibernateServer } = await import("./cryo-sleep-engine");
          const { getServerStatus } = await import("./server-manager");
          const { isWakeProxyRunning } = await import("./cryo-sleep-proxy");
          for (const s of data.config.servers) {
            registerCryoServer({
              serverId: s.id,
              serverName: s.name,
              serverType: s.serverType,
              port: s.allocations?.[0]?.port ?? s.internalPort,
              enabled: !!s.cryoSleepEnabled,
              idleMinutes: s.cryoSleepIdleMinutes ?? data.config.cryosleep.defaultIdleMinutes ?? 10,
              motd: s.cryoSleepMotd,
            });
            if (s.cryoSleepEnabled) {
              const live = await getServerStatus(s.id);
              if (live && live.status === "RUNNING" && !isWakeProxyRunning(s.id)) {
                hibernateServer(s.id).catch(() => {});
              }
            }
          }
        }
      } catch (innerErr) {
        console.warn("[Heartbeat] Engine sync note:", innerErr);
      }
    } else {
      console.warn(`[Heartbeat] Admin responded with HTTP ${res.status}: ${res.statusText}`);
    }
  } catch (err: any) {
    console.warn(`[Heartbeat] Failed to ping admin (${ADMIN_API_URL}):`, err.message);
  }
}
