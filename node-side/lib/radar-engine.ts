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
  if (!clean || clean === "127.0.0.1" || clean === "::1" || clean === "localhost" || clean === "0.0.0.0") return true;
  if (trustedIpsSet.has(clean) || trustedIpsSet.has(ip.trim())) return true;
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

const EXTENDED_PATH = `${process.env.PATH || ""}:/usr/sbin:/sbin:/usr/local/sbin:/usr/bin:/bin`;

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { env: { ...process.env, PATH: EXTENDED_PATH }, timeout: 4000 });
    return stdout.trim();
  } catch (err: any) {
    if (isLinux && !cmd.startsWith("sudo")) {
      try {
        const { stdout } = await execAsync(`sudo -n ${cmd}`, { env: { ...process.env, PATH: EXTENDED_PATH }, timeout: 4000 });
        return stdout.trim();
      } catch {}
    }
    return "";
  }
}

export async function initRadarChain() {
  if (!isLinux) return;
  try {
    // 1. Create RUBBER_RADAR chain if not exists
    await runCmd("iptables -N RUBBER_RADAR 2>/dev/null || true");

    // 2. Ensure control ports (SSH, Web, Node) are ALWAYS immune from drops
    const controlPortsList = Array.from(CONTROL_PORTS).join(",");
    const checkControl = await runCmd(`iptables -C RUBBER_RADAR -p tcp -m multiport --dports ${controlPortsList} -j RETURN 2>/dev/null || true`);
    if (!checkControl) {
      await runCmd(`iptables -I RUBBER_RADAR 1 -p tcp -m multiport --dports ${controlPortsList} -j RETURN 2>/dev/null || true`);
    }

    // 3. Hook RUBBER_RADAR into INPUT chain (host services)
    const checkInput = await runCmd("iptables -C INPUT -j RUBBER_RADAR 2>/dev/null || true");
    if (!checkInput) {
      await runCmd("iptables -I INPUT 1 -j RUBBER_RADAR 2>/dev/null || true");
    }

    // 4. Hook RUBBER_RADAR into DOCKER-USER chain (Docker game servers & containers)
    const checkDocker = await runCmd("iptables -C DOCKER-USER -j RUBBER_RADAR 2>/dev/null || true");
    if (!checkDocker) {
      await runCmd("iptables -I DOCKER-USER 1 -j RUBBER_RADAR 2>/dev/null || true");
    }

    // 5. Hook RUBBER_RADAR into FORWARD chain (generic container forwarding fallback)
    const checkForward = await runCmd("iptables -C FORWARD -j RUBBER_RADAR 2>/dev/null || true");
    if (!checkForward) {
      await runCmd("iptables -I FORWARD 1 -j RUBBER_RADAR 2>/dev/null || true");
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
    await runCmd(`iptables -A RUBBER_RADAR -s ${clean} -j DROP -m comment --comment "Rubber Radar Ban"`);
    // Forcibly close any existing sockets from this banned IP
    await runCmd(`ss -K dst ${clean} 2>/dev/null || true`);
    await runCmd(`conntrack -D -s ${clean} 2>/dev/null || true`);
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

  const key = `${cleanIp}:${port}`;
  let w = connWindows.get(key);
  if (!w) {
    w = { timestamps: [], serverId };
    connWindows.set(key, w);
  }

  w.timestamps.push(now);
  if (serverId) w.serverId = serverId;

  // Filter timestamps within sliding window
  w.timestamps = w.timestamps.filter((t) => now - t < effectiveWindow);
  const count = w.timestamps.length;

  // Check breach
  if (count > effectiveMaxConn && autoMitigate && !activeBans.has(cleanIp)) {
    console.log(`[Radar] 🚨 BREACH: IP ${cleanIp} reached ${count} conns (limit: ${effectiveMaxConn} in ${Math.round(effectiveWindow / 1000)}s) on port ${port}. Auto-banning!`);
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

export function parseSocketEndpoint(addrStr: string): { ip: string; port: number } {
  if (!addrStr) return { ip: "", port: 0 };
  let str = addrStr.trim();
  if (str.startsWith("[") && str.includes("]:")) {
    const bracketEnd = str.indexOf("]:");
    const ip = str.slice(1, bracketEnd);
    const port = parseInt(str.slice(bracketEnd + 2), 10) || 0;
    return { ip: normalizeIp(ip), port };
  }
  const lastColon = str.lastIndexOf(":");
  if (lastColon === -1) return { ip: normalizeIp(str), port: 0 };
  const port = parseInt(str.slice(lastColon + 1), 10) || 0;
  let ip = str.slice(0, lastColon);
  return { ip: normalizeIp(ip), port };
}

function extractEndpointsFromLine(line: string): { local: { ip: string; port: number }; peer: { ip: string; port: number } } | null {
  const parts = line.trim().split(/\s+/);
  // Find all tokens that contain ":" (e.g. 0.0.0.0:25645, 192.168.1.2:54321, [::ffff:192.168.1.3]:25645)
  // Skip process info tokens like users:(("docker-proxy"...))
  const tokens = parts.filter((p) => p.includes(":") && !p.startsWith("users:") && !p.startsWith("pid:") && !p.startsWith("ino:"));
  if (tokens.length >= 2) {
    const local = parseSocketEndpoint(tokens[0]);
    const peer = parseSocketEndpoint(tokens[1]);
    return { local, peer };
  }
  return null;
}

function hexToIpv4(hex: string): string {
  if (hex.length !== 8) return "";
  const b1 = parseInt(hex.substring(6, 8), 16);
  const b2 = parseInt(hex.substring(4, 6), 16);
  const b3 = parseInt(hex.substring(2, 4), 16);
  const b4 = parseInt(hex.substring(0, 2), 16);
  return `${b1}.${b2}.${b3}.${b4}`;
}

function hexToIpv6(hex: string): string {
  if (hex.length !== 32) return "";
  const lower = hex.toLowerCase();
  if (lower.includes("ffff")) {
    const b1 = parseInt(hex.substring(24, 26), 16);
    const b2 = parseInt(hex.substring(26, 28), 16);
    const b3 = parseInt(hex.substring(28, 30), 16);
    const b4 = parseInt(hex.substring(30, 32), 16);
    return `${b4}.${b3}.${b2}.${b1}`;
  }
  return "";
}

function parseProcNetFile(filePath: string): Array<{ localPort: number; peerIp: string; peerPort: number }> {
  const results: Array<{ localPort: number; peerIp: string; peerPort: number }> = [];
  try {
    if (!fs.existsSync(filePath)) return results;
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;

      const localRaw = parts[1];
      const remRaw = parts[2];
      const state = parts[3];

      // Ignore LISTEN (0A)
      if (state === "0A") continue;

      const localParts = localRaw.split(":");
      const remParts = remRaw.split(":");
      if (localParts.length < 2 || remParts.length < 2) continue;

      const localPort = parseInt(localParts[1], 16) || 0;
      const remPort = parseInt(remParts[1], 16) || 0;
      if (!localPort || !remPort) continue;

      let peerIp = "";
      const remHex = remParts[0];
      if (remHex.length === 8) {
        peerIp = hexToIpv4(remHex);
      } else if (remHex.length === 32) {
        peerIp = hexToIpv6(remHex);
      }

      if (peerIp && peerIp !== "0.0.0.0" && peerIp !== "127.0.0.1") {
        results.push({ localPort, peerIp, peerPort: remPort });
      }
    }
  } catch {}
  return results;
}

let isScanningConnections = false;
const seenClientSockets = new Map<string, number>();

async function scanActiveConnections() {
  if (isScanningConnections) return;
  isScanningConnections = true;

  try {
    const now = Date.now();

    // Cap Map sizes to prevent memory leaks
    if (connWindows.size > 1000) {
      for (const [key, w] of connWindows.entries()) {
        w.timestamps = w.timestamps.filter((t) => now - t < 30000);
        if (w.timestamps.length === 0) connWindows.delete(key);
      }
    }

    // Prune seenClientSockets older than 15s
    for (const [sock, ts] of seenClientSockets.entries()) {
      if (now - ts > 15000) seenClientSockets.delete(sock);
    }

    const agentPort = Number(process.env.AGENT_PORT || process.env.PORT || 3001);

    // 1. Direct Linux kernel /proc/net/tcp & /proc/net/tcp6 inspection (fastest, zero-subprocess)
    if (isLinux) {
      const procSockets = [
        ...parseProcNetFile("/proc/net/tcp"),
        ...parseProcNetFile("/proc/net/tcp6"),
      ];
      for (const sock of procSockets) {
        if (
          sock.localPort >= 1024 &&
          sock.localPort <= 65535 &&
          !CONTROL_PORTS.has(sock.localPort) &&
          sock.localPort !== agentPort &&
          sock.peerIp &&
          sock.peerPort > 0 &&
          !isIpTrusted(sock.peerIp)
        ) {
          const sockKey = `${sock.peerIp}:${sock.peerPort}->${sock.localPort}`;
          if (!seenClientSockets.has(sockKey)) {
            seenClientSockets.set(sockKey, now);
            recordConnection(sock.peerIp, sock.localPort, undefined, now);
          }
        }
      }
    }

    // 2. Command-based scan fallback (ss / netstat)
    const cmd = isLinux
      ? "ss -t -a -n -H 2>/dev/null || ss -H -n -t 2>/dev/null || netstat -tan 2>/dev/null"
      : "netstat -ano -p tcp";

    const out = await runCmd(cmd);
    if (out) {
      const lines = out.split("\n");
      for (const line of lines) {
        const ep = extractEndpointsFromLine(line);
        if (!ep) continue;

        const { local, peer } = ep;

        if (
          local.port >= 1024 &&
          local.port <= 65535 &&
          !CONTROL_PORTS.has(local.port) &&
          local.port !== agentPort &&
          peer.ip &&
          peer.port > 0 &&
          !isIpTrusted(peer.ip)
        ) {
          const sockKey = `${peer.ip}:${peer.port}->${local.port}`;
          if (!seenClientSockets.has(sockKey)) {
            seenClientSockets.set(sockKey, now);
            recordConnection(peer.ip, local.port, undefined, now);
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

// Main Telemetry loop (every 1s)
let radarLoopRunning = false;
export function startRadarLoop() {
  if (radarLoopRunning) return;
  radarLoopRunning = true;
  console.log("[Radar Engine] 🛡️ Traffic Radar & Threat Shield loop STARTED (polling every 1000ms)");
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
      if (recentSamples.length > 900) {
        // Keep 15 minutes of 1s samples
        recentSamples.shift();
      }
    } catch (err) {
      console.error("Radar telemetry loop error:", err);
    }
  }, 1000);
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
