/**
 * Rubber Panel — Traffic Radar Engine (Node Daemon)
 * In-process network traffic telemetry, sliding-window anomaly detection,
 * geo-intelligence, and local iptables abuse mitigation.
 */

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { lookupCountry } from "./geoip";

const execAsync = promisify(exec);

export interface TopOffender {
  ip: string;
  connCount: number;
  country: string;
  countryName: string;
  port?: number;
  serverId?: string;
  isBanned: boolean;
  firstSeen: number;
  lastSeen: number;
}

export interface ActiveBan {
  ip: string;
  port?: number;
  serverId?: string;
  reason: string;
  country: string;
  createdAt: number;
  expiresAt: number;
  manual: boolean;
}

export interface RadarSamplePoint {
  timestamp: number;
  connsPerSec: number;
  bytesPerSecIn: number;
  bytesPerSecOut: number;
  droppedPackets: number;
  activeBans: number;
}

export interface RadarEvent {
  id: string;
  type: "ban" | "unban" | "warning" | "shield_mode" | "under_attack";
  ip?: string;
  port?: number;
  serverId?: string;
  reason: string;
  country?: string;
  timestamp: number;
  expiresAt?: number;
}

export interface ServerThresholdConfig {
  serverId: string;
  maxConnPerIpPerWindow: number;
  windowMs: number;
  banDurationMs: number;
  autoMitigate: boolean;
  underAttackMode: boolean;
  underAttackExpiresAt?: number;
}

// ─── SLIDING WINDOW & IN-MEMORY STATE ───────────────────────────────────────

type IpWindow = { timestamps: number[]; serverId?: string };

declare global {
  var __rubberRadarConnWindows: Map<string, IpWindow> | undefined;
  var __rubberRadarActiveBans: Map<string, ActiveBan> | undefined;
  var __rubberRadarUnbanTimers: Map<string, NodeJS.Timeout> | undefined;
  var __rubberRadarRecentEvents: RadarEvent[] | undefined;
  var __rubberRadarBytesIn: number | undefined;
  var __rubberRadarBytesOut: number | undefined;
}

if (!globalThis.__rubberRadarConnWindows) {
  globalThis.__rubberRadarConnWindows = new Map<string, IpWindow>();
}
if (!globalThis.__rubberRadarActiveBans) {
  globalThis.__rubberRadarActiveBans = new Map<string, ActiveBan>();
}
if (!globalThis.__rubberRadarUnbanTimers) {
  globalThis.__rubberRadarUnbanTimers = new Map<string, NodeJS.Timeout>();
}
if (!globalThis.__rubberRadarRecentEvents) {
  globalThis.__rubberRadarRecentEvents = [];
}

const connWindows = globalThis.__rubberRadarConnWindows;
const activeBans = globalThis.__rubberRadarActiveBans;
const unbanTimers = globalThis.__rubberRadarUnbanTimers;
const recentEvents = globalThis.__rubberRadarRecentEvents;
const recentSamples: RadarSamplePoint[] = [];
const trustedIpsSet = new Set<string>();

let serverThresholds = new Map<string, ServerThresholdConfig>();
let globalThreshold: ServerThresholdConfig = {
  serverId: "GLOBAL",
  maxConnPerIpPerWindow: 20,
  windowMs: 10000,
  banDurationMs: 900000, // 15 minutes
  autoMitigate: true,
  underAttackMode: false,
};

let fleetShieldMode = false;
let lastBytesIn = 0;
let lastBytesOut = 0;
let lastCheckTime = Date.now();
let droppedPacketsCounter = 0;
let isLinux = process.platform === "linux";

const RFC1918_PREFIXES = [
  "10.",
  "192.168.",
  "127.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "::1",
  "fe80:",
  "0.0.0.0",
  "localhost",
];

export const CONTROL_PORTS = new Set([22, 80, 443, 3000, 3001, 3002]);

export function normalizeIp(ip: string): string {
  let clean = (ip || "").trim().replace(/^\[|\]$/g, "");
  if (clean.startsWith("::ffff:")) {
    clean = clean.substring(7);
  }
  return clean;
}

export function isIpTrusted(ip: string): boolean {
  const clean = normalizeIp(ip);
  if (!clean || clean === "127.0.0.1" || clean === "::1" || clean === "localhost") return true;
  if (trustedIpsSet.has(clean) || trustedIpsSet.has(ip.trim())) return true;
  for (const prefix of RFC1918_PREFIXES) {
    if (clean.startsWith(prefix)) return true;
  }
  return false;
}

export function updateTrustedIps(ips: string[]) {
  trustedIpsSet.clear();
  for (const ip of ips) {
    if (ip && ip.trim()) {
      trustedIpsSet.add(normalizeIp(ip));
    }
  }
}

// ─── IPTABLES RUBBER_RADAR CHAIN MANAGEMENT ─────────────────────────────────

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd);
    return stdout.trim();
  } catch (err: any) {
    // If not on Linux or unprivileged, return empty without crashing
    return "";
  }
}

export async function initRadarChain() {
  if (!isLinux) return;
  try {
    // Create RUBBER_RADAR chain if not exists
    await runCmd("iptables -N RUBBER_RADAR");
    // Ensure rule is hooked at top of INPUT chain
    const check = await runCmd("iptables -C INPUT -j RUBBER_RADAR");
    if (!check) {
      await runCmd("iptables -I INPUT 1 -j RUBBER_RADAR");
    }
  } catch {
    // Graceful fallback
  }
}

async function applyIptablesBan(ip: string) {
  if (!isLinux) return;
  const clean = normalizeIp(ip);
  if (isIpTrusted(clean)) return;
  try {
    await runCmd(`iptables -I RUBBER_RADAR 1 -s ${clean} -j DROP -m comment --comment "Rubber Radar Ban"`);
  } catch {}
}

async function removeIptablesBan(ip: string) {
  if (!isLinux) return;
  const clean = normalizeIp(ip);
  try {
    await runCmd(`iptables -D RUBBER_RADAR -s ${clean} -j DROP -m comment --comment "Rubber Radar Ban"`);
  } catch {}
}

// ─── IP & BAN MANAGEMENT ───────────────────────────────────────────────────

export function getCountryInfo(ip: string): { code: string; name: string } {
  return lookupCountry(normalizeIp(ip));
}

export function banIp(
  ip: string,
  reason: string,
  durationMs = 900000,
  port?: number,
  serverId?: string,
  manual = false
): boolean {
  const cleanIp = normalizeIp(ip);
  if (isIpTrusted(cleanIp)) {
    return false;
  }

  const agentPort = Number(process.env.AGENT_PORT || process.env.PORT || 3001);
  if (port && (CONTROL_PORTS.has(port) || port === agentPort)) {
    return false;
  }

  const existingTimer = unbanTimers.get(cleanIp);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const now = Date.now();
  const expiresAt = now + durationMs;
  const geo = getCountryInfo(cleanIp);

  activeBans.set(cleanIp, {
    ip: cleanIp,
    port,
    serverId,
    reason,
    country: geo.code,
    createdAt: now,
    expiresAt,
    manual,
  });

  applyIptablesBan(cleanIp);

  // Auto-expire timer
  const timer = setTimeout(() => {
    unbanIp(cleanIp);
  }, durationMs);
  unbanTimers.set(cleanIp, timer);

  // Emit event
  addRadarEvent({
    id: `event-${now}-${Math.random().toString(36).substring(2, 7)}`,
    type: "ban",
    ip: cleanIp,
    port,
    serverId,
    reason,
    country: geo.code,
    timestamp: now,
    expiresAt,
  });

  return true;
}

export function isIpBanned(ip: string): boolean {
  const clean = ip.trim();
  const ban = activeBans.get(clean);
  if (!ban) return false;
  if (Date.now() > ban.expiresAt) {
    unbanIp(clean);
    return false;
  }
  return true;
}

export function unbanIp(ip: string): boolean {
  const cleanIp = ip.trim();
  const ban = activeBans.get(cleanIp);
  if (!ban) return false;

  const timer = unbanTimers.get(cleanIp);
  if (timer) {
    clearTimeout(timer);
    unbanTimers.delete(cleanIp);
  }

  activeBans.delete(cleanIp);
  removeIptablesBan(cleanIp);

  addRadarEvent({
    id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "unban",
    ip: cleanIp,
    port: ban.port,
    serverId: ban.serverId,
    reason: "Ban duration expired or removed by administrator",
    country: ban.country,
    timestamp: Date.now(),
  });

  return true;
}

export function addRadarEvent(event: RadarEvent) {
  recentEvents.unshift(event);
  if (recentEvents.length > 200) {
    recentEvents.pop();
  }
}

export function recordIncomingTraffic(
  bytesIn: number,
  bytesOut: number,
  ip = "127.0.0.1",
  port = 3001,
  serverId?: string
) {
  globalThis.__rubberRadarBytesIn = (globalThis.__rubberRadarBytesIn || 0) + bytesIn;
  globalThis.__rubberRadarBytesOut = (globalThis.__rubberRadarBytesOut || 0) + bytesOut;
  recordConnection(ip, port, serverId);
}

// ─── SLIDING WINDOW CONNS / SEC TRACKER ─────────────────────────────────────

export function recordConnection(ip: string, port: number, serverId?: string, now = Date.now()): number {
  const cleanIp = normalizeIp(ip);
  const agentPort = Number(process.env.AGENT_PORT || process.env.PORT || 3001);

  if (CONTROL_PORTS.has(port) || port === agentPort || isIpTrusted(cleanIp)) {
    return 0;
  }

  const key = `${cleanIp}:${port}`;
  let w = connWindows.get(key);
  if (!w) {
    w = { timestamps: [], serverId };
    connWindows.set(key, w);
  }

  w.timestamps.push(now);
  if (serverId) w.serverId = serverId;

  // Filter timestamps within sliding window
  w.timestamps = w.timestamps.filter((t) => now - t < 10000);
  const count = w.timestamps.length;

  // Determine effective threshold
  let effectiveMaxConn = globalThreshold.maxConnPerIpPerWindow;
  let effectiveWindow = globalThreshold.windowMs;
  let effectiveBanDuration = globalThreshold.banDurationMs;
  let autoMitigate = globalThreshold.autoMitigate;

  if (serverId && serverThresholds.has(serverId)) {
    const st = serverThresholds.get(serverId)!;
    effectiveMaxConn = st.maxConnPerIpPerWindow;
    effectiveWindow = st.windowMs;
    effectiveBanDuration = st.banDurationMs;
    autoMitigate = st.autoMitigate;
    if (st.underAttackMode) {
      effectiveMaxConn = Math.max(3, Math.floor(effectiveMaxConn / 3)); // Strict throttle under attack
    }
  }

  if (fleetShieldMode) {
    effectiveMaxConn = Math.max(5, Math.floor(effectiveMaxConn / 2)); // Strict fleet shield
  }

  // Check breach
  if (count > effectiveMaxConn && autoMitigate && !activeBans.has(cleanIp)) {
    banIp(
      cleanIp,
      `Exceeded connection rate limit (${count} conns in ${Math.round(effectiveWindow / 1000)}s on port ${port})`,
      effectiveBanDuration,
      port,
      serverId,
      false
    );
  }

  return count;
}

// ─── DATA COLLECTION & TELEMETRY LOOP ───────────────────────────────────────

async function collectNetworkBandwidth(): Promise<{ bytesInDelta: number; bytesOutDelta: number; dropDelta: number }> {
  let totalBytesIn = 0;
  let totalBytesOut = 0;

  try {
    if (isLinux && fs.existsSync("/proc/net/dev")) {
      const content = fs.readFileSync("/proc/net/dev", "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes(":") && !line.includes("lo:")) {
          const parts = line.split(":")[1].trim().split(/\s+/);
          if (parts.length >= 9) {
            totalBytesIn += parseInt(parts[0], 10) || 0;
            totalBytesOut += parseInt(parts[8], 10) || 0;
          }
        }
      }
    }
  } catch {}

  const now = Date.now();
  const timeDeltaSec = Math.max(1, (now - lastCheckTime) / 1000);

  let bytesInDelta = 0;
  let bytesOutDelta = 0;

  if (lastBytesIn > 0 && totalBytesIn >= lastBytesIn) {
    bytesInDelta = Math.round((totalBytesIn - lastBytesIn) / timeDeltaSec);
  }
  if (lastBytesOut > 0 && totalBytesOut >= lastBytesOut) {
    bytesOutDelta = Math.round((totalBytesOut - lastBytesOut) / timeDeltaSec);
  }

  // Add in-process tracked bytes from proxy and active socket telemetry
  const inBytes = globalThis.__rubberRadarBytesIn || 0;
  const outBytes = globalThis.__rubberRadarBytesOut || 0;
  globalThis.__rubberRadarBytesIn = 0;
  globalThis.__rubberRadarBytesOut = 0;

  if (inBytes > 0) {
    bytesInDelta += Math.round(inBytes / timeDeltaSec);
  }
  if (outBytes > 0) {
    bytesOutDelta += Math.round(outBytes / timeDeltaSec);
  }

  lastBytesIn = totalBytesIn;
  lastBytesOut = totalBytesOut;
  lastCheckTime = now;

  return { bytesInDelta, bytesOutDelta, dropDelta: droppedPacketsCounter };
}

let isScanningConnections = false;

async function scanActiveConnections() {
  if (isScanningConnections) return;
  isScanningConnections = true;

  try {
    const now = Date.now();

    // Cap Map size to prevent memory leaks
    if (connWindows.size > 1000) {
      for (const [key, w] of connWindows.entries()) {
        w.timestamps = w.timestamps.filter((t) => now - t < 30000);
        if (w.timestamps.length === 0) connWindows.delete(key);
      }
    }

    const agentPort = Number(process.env.AGENT_PORT || process.env.PORT || 3001);

    if (isLinux) {
      // Scan established connections via ss on Linux
      const out = await runCmd("ss -H -t -o state established");
      if (out) {
        const lines = out.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          // Format: Recv-Q Send-Q Local Address:Port Peer Address:Port
          if (parts.length >= 5) {
            const local = parts[3];
            const peer = parts[4];
            const localPort = parseInt(local.split(":").pop() || "0", 10);
            const peerIp = peer.split(":")[0]?.replace(/^\[|\]$/g, "");

            if (
              localPort >= 1024 &&
              localPort <= 65535 &&
              !CONTROL_PORTS.has(localPort) &&
              localPort !== agentPort &&
              peerIp &&
              !isIpTrusted(peerIp)
            ) {
              recordConnection(peerIp, localPort, undefined, now);
            }
          }
        }
      }
    } else {
      // Windows fallback via netstat
      const out = await runCmd("netstat -ano -p tcp");
      if (out) {
        const lines = out.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          // Format: TCP Local_Address Foreign_Address State PID
          if (parts.length >= 4 && parts[3] === "ESTABLISHED") {
            const local = parts[1];
            const peer = parts[2];
            const localPort = parseInt(local.split(":").pop() || "0", 10);
            const peerIp = peer.split(":")[0]?.replace(/^\[|\]$/g, "");

            // Only track game server ports (e.g. 25500-30000 or non-control ports)
            if (
              localPort >= 1024 &&
              !CONTROL_PORTS.has(localPort) &&
              localPort !== agentPort &&
              peerIp &&
              !isIpTrusted(peerIp)
            ) {
              recordConnection(peerIp, localPort, undefined, now);
            }
          }
        }
      }
    }
  } catch {
  } finally {
    isScanningConnections = false;
  }
}

function computeTopOffenders(): TopOffender[] {
  const offendersMap = new Map<string, { count: number; port?: number; serverId?: string; firstSeen: number; lastSeen: number }>();
  const now = Date.now();

  for (const [key, w] of connWindows.entries()) {
    const [ip, portStr] = key.split(":");
    const port = parseInt(portStr, 10);
    const recent = w.timestamps.filter((t) => now - t < 60000);
    if (recent.length > 0) {
      const existing = offendersMap.get(ip);
      if (existing) {
        existing.count += recent.length;
        existing.lastSeen = Math.max(existing.lastSeen, Math.max(...recent));
      } else {
        offendersMap.set(ip, {
          count: recent.length,
          port,
          serverId: w.serverId,
          firstSeen: Math.min(...recent),
          lastSeen: Math.max(...recent),
        });
      }
    }
  }

  // Also include currently banned IPs even if quieted
  for (const [ip, ban] of activeBans.entries()) {
    if (!offendersMap.has(ip)) {
      offendersMap.set(ip, {
        count: 0,
        port: ban.port,
        serverId: ban.serverId,
        firstSeen: ban.createdAt,
        lastSeen: ban.createdAt,
      });
    }
  }

  const list: TopOffender[] = [];
  for (const [ip, data] of offendersMap.entries()) {
    const geo = getCountryInfo(ip);
    list.push({
      ip,
      connCount: data.count,
      country: geo.code,
      countryName: geo.name,
      port: data.port,
      serverId: data.serverId,
      isBanned: activeBans.has(ip),
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
    });
  }

  return list.sort((a, b) => b.connCount - a.connCount).slice(0, 50);
}

// Cleanup stale connection windows every 10s
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of connWindows.entries()) {
    w.timestamps = w.timestamps.filter((t) => now - t < 60000);
    if (w.timestamps.length === 0) {
      connWindows.delete(key);
    }
  }
}, 10000);

// Main Telemetry loop (every 2s)
let radarLoopRunning = false;
export function startRadarLoop() {
  if (radarLoopRunning) return;
  radarLoopRunning = true;
  initRadarChain();

  setInterval(async () => {
    try {
      await scanActiveConnections();
      const { bytesInDelta, bytesOutDelta } = await collectNetworkBandwidth();
      
      // Calculate active conns/sec
      const now = Date.now();
      let totalConnsLastSec = 0;
      for (const w of connWindows.values()) {
        totalConnsLastSec += w.timestamps.filter((t) => now - t < 1000).length;
      }

      const sample: RadarSamplePoint = {
        timestamp: now,
        connsPerSec: totalConnsLastSec,
        bytesPerSecIn: bytesInDelta,
        bytesPerSecOut: bytesOutDelta,
        droppedPackets: droppedPacketsCounter,
        activeBans: activeBans.size,
      };

      recentSamples.push(sample);
      if (recentSamples.length > 450) {
        // Keep 15 minutes of 2s samples
        recentSamples.shift();
      }
    } catch (err) {
      console.error("Radar telemetry loop error:", err);
    }
  }, 2000);
}

// ─── PUBLIC RADAR ENGINE APIS ───────────────────────────────────────────────

export function getRadarStats() {
  const now = Date.now();
  const latestSample = recentSamples[recentSamples.length - 1] || {
    timestamp: now,
    connsPerSec: 0,
    bytesPerSecIn: 0,
    bytesPerSecOut: 0,
    droppedPackets: 0,
    activeBans: activeBans.size,
  };

  return {
    timestamp: now,
    shieldMode: fleetShieldMode,
    current: latestSample,
    activeBansCount: activeBans.size,
    activeBansList: Array.from(activeBans.values()),
    topOffenders: computeTopOffenders(),
    history: recentSamples.slice(-90), // Last ~3-15 min
    recentEvents: recentEvents.slice(0, 30),
  };
}

export function setFleetShieldMode(enabled: boolean) {
  fleetShieldMode = enabled;
  addRadarEvent({
    id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "shield_mode",
    reason: enabled ? "Fleet-wide Shield Mode activated (stricter rate limits)" : "Fleet-wide Shield Mode deactivated",
    timestamp: Date.now(),
  });
}

export function setServerUnderAttack(serverId: string, enabled: boolean, durationMs = 3600000) {
  let conf = serverThresholds.get(serverId) || {
    serverId,
    maxConnPerIpPerWindow: globalThreshold.maxConnPerIpPerWindow,
    windowMs: globalThreshold.windowMs,
    banDurationMs: globalThreshold.banDurationMs,
    autoMitigate: true,
    underAttackMode: false,
  };

  conf.underAttackMode = enabled;
  conf.underAttackExpiresAt = enabled ? Date.now() + durationMs : undefined;
  serverThresholds.set(serverId, conf);

  if (enabled) {
    setTimeout(() => {
      const cur = serverThresholds.get(serverId);
      if (cur && cur.underAttackMode && cur.underAttackExpiresAt && Date.now() >= cur.underAttackExpiresAt) {
        cur.underAttackMode = false;
        cur.underAttackExpiresAt = undefined;
        serverThresholds.set(serverId, cur);
      }
    }, durationMs);
  }

  addRadarEvent({
    id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: "under_attack",
    serverId,
    reason: enabled ? "Server Under Attack Mode enabled (strict connection threshold)" : "Server Under Attack Mode disabled",
    timestamp: Date.now(),
  });
}

export function updateServerThresholds(thresholds: Record<string, ServerThresholdConfig>) {
  for (const [sId, conf] of Object.entries(thresholds)) {
    if (sId === "GLOBAL") {
      globalThreshold = { ...globalThreshold, ...conf };
    } else {
      serverThresholds.set(sId, conf);
    }
  }
}
