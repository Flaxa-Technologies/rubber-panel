// heartbeat-worker.ts — Sends periodic heartbeats from the node agent to the admin panel
// Runs in the Node.js server process via instrumentation.ts

import { getNodeResources } from "./resource-monitor";
import { getAllServers } from "./server-manager";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const NODE_TOKEN = process.env.NODE_TOKEN ?? "";
const NODE_ID = process.env.NODE_ID ?? "";
const INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS ?? "30") * 1000;

let started = false;

export function startHeartbeat() {
  if (started) return;
  started = true;

  // Don't start if not configured
  if (!NODE_TOKEN || NODE_TOKEN === "dev-token-placeholder") {
    console.log("[Heartbeat] NODE_TOKEN not set — heartbeat disabled. Configure .env to connect to admin.");
    return;
  }
  if (!NODE_ID || NODE_ID === "dev-node-id") {
    console.log("[Heartbeat] NODE_ID not set — heartbeat disabled. Configure .env to connect to admin.");
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
    // (This ensures our in-memory state is accurate before sending to admin)
    const { getServerStatus } = await import("./server-manager");
    for (const s of servers) {
      if (s.status === "RUNNING") await getServerStatus(s.id);
    }

    let currentVer = "0.1.0";
    try {
      const fs = await import("fs");
      const path = await import("path");
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
      if (pkg?.version) currentVer = pkg.version;
    } catch {}

    const payload = {
      nodeId: NODE_ID,
      agentVersion: currentVer,
      cpuUsage: resources.cpuUsage,
      ramUsage: resources.ramUsage,
      diskUsage: 0, // TODO: real disk usage
      networkRx: 0,
      networkTx: 0,
      serverStatuses: servers.map(s => ({ id: s.id, status: s.status })),
    };

    const res = await fetch(`${ADMIN_API_URL}/api/node/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NODE_TOKEN}`,
        "X-Node-Id": NODE_ID,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RubberPanel/2.0 (Flaxa Studios)",
        "Bypass-Tunnel-Reminder": "true",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      console.log(`[Heartbeat] ✓ OK — ${new Date().toLocaleTimeString()}`);
      try {
        const data = await res.json();
        if (data?.config?.cryosleep) {
          const { initCryoSleepEngine } = await import("./cryo-sleep-engine");
          initCryoSleepEngine(data.config.cryosleep);
        }
        if (data?.config?.bootPolicy) {
          // Sync boot policy
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
              port: s.port || 25565,
              serverType: s.serverType === "NODEJS" ? "NODEJS" : "MINECRAFT",
              enabled: s.cryoSleepEnabled === true,
              idleMinutes: s.cryoSleepIdleMinutes || 10,
              motd: s.cryoSleepMotd,
            });

            if (s.cryoSleepEnabled === true) {
              const sleeping = isWakeProxyRunning(s.id);
              if (!sleeping) {
                const curStatus = await getServerStatus(s.id);
                if (!curStatus || curStatus.status !== "RUNNING") {
                  await hibernateServer(s.id, "Heartbeat auto-sync wake proxy").catch(() => {});
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error("[Heartbeat] Error processing admin config payload:", err);
      }
    } else {
      const text = await res.text().catch(() => res.status.toString());
      console.warn(`[Heartbeat] ✗ Admin responded ${res.status}: ${text}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Heartbeat] ✗ Failed to reach admin: ${msg}`);
  }
}
