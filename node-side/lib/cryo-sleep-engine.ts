import { startWakeProxy, stopWakeProxy, isWakeProxyRunning, DEFAULT_CRYO_MOTD, DEFAULT_WAKE_MESSAGE } from "./cryo-sleep-proxy";
import { getServerStatus, startServer, stopServer, appendLog, ServerInfo } from "./server-manager";

export interface CryoServerConfig {
  serverId: string;
  serverName: string;
  port: number;
  serverType?: "MINECRAFT" | "NODEJS";
  enabled: boolean;
  idleMinutes: number;
  motd?: string;
  wakeMessage?: string;
}

// In-memory config map: serverId -> CryoServerConfig
const serverConfigs = new Map<string, CryoServerConfig>();

// In-memory tracker for when a server last had active players: serverId -> timestamp
const lastActiveTimestamps = new Map<string, number>();

// In-memory tracker for server player counts: serverId -> count
const playerCounts = new Map<string, number>();

// Engine running state
let engineInterval: NodeJS.Timeout | null = null;

/**
 * Register or update Cryo-Sleep configuration for a server.
 */
export function registerCryoServer(config: CryoServerConfig) {
  serverConfigs.set(config.serverId, config);
  if (!lastActiveTimestamps.has(config.serverId)) {
    lastActiveTimestamps.set(config.serverId, Date.now());
  }
}

/**
 * Unregister a server from Cryo-Sleep (e.g. on delete).
 */
export function unregisterCryoServer(serverId: string) {
  serverConfigs.delete(serverId);
  lastActiveTimestamps.delete(serverId);
  playerCounts.delete(serverId);
  stopWakeProxy(serverId).catch(() => {});
}

/**
 * Update player count for a server (called by RCON / log listeners).
 */
export function updateServerPlayerCount(serverId: string, count: number) {
  playerCounts.set(serverId, count);
  if (count > 0) {
    lastActiveTimestamps.set(serverId, Date.now());
  }
}

/**
 * Reset active idle timer (e.g. on server start or player connection).
 */
export function resetServerActiveTimer(serverId: string) {
  lastActiveTimestamps.set(serverId, Date.now());
}

/**
 * Manually or automatically hibernate a server into Cryo-Sleep.
 */
export async function hibernateServer(serverId: string, reason = "Idle timeout"): Promise<{ success: boolean; error?: string }> {
  const config = serverConfigs.get(serverId);
  const status = await getServerStatus(serverId);

  if (!status) {
    return { success: false, error: "Server not found on this node" };
  }

  if (status.status === "STARTING" || status.status === "WAKING" || status.status === "INSTALLING") {
    console.log(`[Cryo-Sleep] Server ${serverId} is currently ${status.status}. Skipping hibernation.`);
    return { success: false, error: `Server is currently ${status.status}` };
  }

  const assignedPort = config?.port || status.port || 25565;
  const serverName = config?.serverName || status.name || "Server";
  const serverType = config?.serverType || (status.environment?.SERVER_TYPE === "NODEJS" ? "NODEJS" : "MINECRAFT");

  console.log(`[Cryo-Sleep] Initiating hibernation for server "${serverName}" (${serverId}) — Reason: ${reason}`);
  appendLog(serverId, `[Cryo-Sleep] 💤 Entering Cryo-Sleep hibernation (${reason}). Dropping RAM & CPU to 0%...`);

  try {
    // 1. If Minecraft and active, send /save-all before stopping
    if (serverType === "MINECRAFT") {
      try {
        const { sendCommand } = await import("./server-manager");
        await sendCommand(serverId, "save-all").catch(() => {});
      } catch {}
    }

    // 2. Stop the server container if running
    try {
      await stopServer(serverId, false).catch(() => {});
    } catch {}

    // 3. Mark status as SLEEPING
    status.status = "SLEEPING" as any;
    (status as any).isCryoSleeping = true;

    // 4. Start the lightweight wake proxy on the assigned port
    await startWakeProxy({
      serverId,
      serverName,
      port: assignedPort,
      serverType,
      motd: config?.motd || DEFAULT_CRYO_MOTD,
      wakeMessage: config?.wakeMessage || DEFAULT_WAKE_MESSAGE,
      onWake: async (sid, details) => {
        console.log(`[Cryo-Sleep] Wake sequence triggered for ${sid} via ${details.source}`);
        await wakeServer(sid, `Player connection (${details.player || details.ip || details.source})`);
      },
    });

    appendLog(serverId, `[Cryo-Sleep] ✓ Wake proxy active on port ${assignedPort}. Listening for connections to auto-wake!`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Cryo-Sleep] Failed to enter hibernation for ${serverId}:`, err);
    appendLog(serverId, `[Cryo-Sleep] ✗ Failed to start wake proxy: ${err.message}`);
    return { success: false, error: err.message };
  }
}

const wakingServers = new Set<string>();

/**
 * Wake a server up from Cryo-Sleep.
 */
export async function wakeServer(serverId: string, trigger = "Manual wake"): Promise<{ success: boolean; error?: string }> {
  if (wakingServers.has(serverId)) {
    console.log(`[Cryo-Sleep] Wake already in progress for ${serverId}. Skipping duplicate trigger.`);
    return { success: true };
  }
  wakingServers.add(serverId);

  try {
    console.log(`[Cryo-Sleep] ⚡ WAKING server ${serverId} (${trigger})`);
    appendLog(serverId, `[Cryo-Sleep] ⚡ Wake sequence initiated (${trigger})! Booting instance...`);

    // 1. Stop and release the wake proxy TCP port
    const config = serverConfigs.get(serverId);
    const status = await getServerStatus(serverId);
    const targetPort = config?.port || status?.port || 25565;
    await stopWakeProxy(serverId, targetPort).catch(() => {});
    const { stopWakeProxyByPort } = await import("./cryo-sleep-proxy");
    await stopWakeProxyByPort(targetPort).catch(() => {});

    // 2. Reset last active timer
    lastActiveTimestamps.set(serverId, Date.now());

    // 3. Start the actual server container
    const startResult = await startServer(serverId);
    if (!startResult.success) {
      appendLog(serverId, `[Cryo-Sleep] ✗ Failed to boot container on wake: ${startResult.error}`);
      return startResult;
    }

    appendLog(serverId, `[Cryo-Sleep] ✓ Server online and ready on assigned port!`);
    return { success: true };
  } finally {
    // Keep lock for a couple seconds while container stabilizes
    setTimeout(() => wakingServers.delete(serverId), 5000);
  }
}

let globalConfigState: {
  defaultEnabled?: boolean;
  defaultIdleMinutes?: number;
  defaultMotd?: string;
  wakeMessage?: string;
} = {};

export function getCryoGlobalDefaults() {
  return globalConfigState;
}

let nodeBootPolicyState: {
  autoStartServersOnBoot?: boolean;
  bootCryoSleepMode?: string;
  bootGracePeriodSeconds?: number;
  maxConcurrentBootStarts?: number;
  bootStartupDelaySeconds?: number;
} = {
  autoStartServersOnBoot: false,
  bootCryoSleepMode: "CRYO_HIBERNATE_ALL",
  bootGracePeriodSeconds: 15,
  maxConcurrentBootStarts: 3,
  bootStartupDelaySeconds: 5,
};

export function getNodeBootPolicy() {
  return nodeBootPolicyState;
}

export function syncBootPolicy(policy: Partial<typeof nodeBootPolicyState>) {
  nodeBootPolicyState = { ...nodeBootPolicyState, ...policy };
}

/**
 * Initializes the background Cryo-Sleep monitoring loop and updates global defaults.
 * Runs automatically on daemon start and syncs on heartbeat.
 */
export function initCryoSleepEngine(config?: {
  defaultEnabled?: boolean;
  defaultIdleMinutes?: number;
  defaultMotd?: string;
  wakeMessage?: string;
}) {
  if (config) {
    globalConfigState = { ...globalConfigState, ...config };
  }

  if (engineInterval) return;

  console.log("[Cryo-Sleep Engine] Initialized and monitoring idle server instances.");

  // Check every 30 seconds for idle servers
  engineInterval = setInterval(async () => {
    try {
      const now = Date.now();

      for (const [serverId, config] of serverConfigs.entries()) {
        if (!config.enabled) continue;

        // Skip if already sleeping or wake proxy is active
        if (isWakeProxyRunning(serverId)) continue;

        const status = await getServerStatus(serverId);
        if (!status || status.status !== "RUNNING") continue;

        // Ensure at least 3 minutes grace period after container start before idle checks begin
        const lastActive = lastActiveTimestamps.get(serverId) ?? now;
        const uptimeMs = now - lastActive;
        if (uptimeMs < 180000) {
          continue;
        }

        const currentPlayers = playerCounts.get(serverId) ?? 0;
        const targetIdleMs = Math.max(1, config.idleMinutes) * 60 * 1000;

        // If 0 players online and idle timeout exceeded -> hibernate!
        if (currentPlayers === 0 && uptimeMs >= targetIdleMs) {
          await hibernateServer(serverId, `${config.idleMinutes}m idle timeout with 0 players`);
        }
      }
    } catch (err: any) {
      console.warn("[Cryo-Sleep Engine] Error in monitoring cycle:", err.message);
    }
  }, 30000);
}
