import fs from "fs";
import path from "path";
import os from "os";

export interface NodeResources {
  cpuUsage: number;        // percentage 0-100
  ramUsage: number;        // percentage 0-100 (Host System RAM Used %)
  ramUsedMb: number;       // Host Total System RAM Used (MB)
  ramTotalMb: number;      // Host Physical Hardware RAM (MB)
  ramFreeMb: number;       // Host Free RAM (MB)
  diskUsage: number;       // percentage 0-100 (Host Root Disk %)
  diskUsedGb: number;      // Host Total Root Disk Used (GB)
  diskTotalGb: number;     // Host Total Root Disk Size (GB)
  diskTotalMb: number;     // Host Total Root Disk Size (MB)
  diskUsedMb: number;      // Host Total Root Disk Used (MB)
  serversDiskUsedMb: number; // Space used by game servers directory /var/rubber-panel/servers (MB)
  networkRx: number;       // bytes/sec
  networkTx: number;       // bytes/sec
  loadAvg: number[];
  uptime: number;          // seconds
}

let cachedCpuUsage = 0;
let prevCpuInfo: os.CpuInfo[] | null = null;

let cachedServerDiskUsedMb = 0;
let lastDiskScan = 0;

function computeCpuUsage() {
  const cpus = os.cpus();
  if (!prevCpuInfo) {
    prevCpuInfo = cpus;
    return;
  }

  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i];
    const prev = prevCpuInfo[i];

    for (const type of Object.keys(cpu.times) as Array<keyof os.CpuInfo["times"]>) {
      totalTick += cpu.times[type] - prev.times[type];
    }
    totalIdle += cpu.times.idle - prev.times.idle;
  }

  prevCpuInfo = cpus;
  const idle = totalTick > 0 ? (totalIdle / totalTick) * 100 : 100;
  cachedCpuUsage = Math.max(0, Math.min(100, 100 - idle));
}

// Compute CPU immediately and then every 2 seconds
computeCpuUsage();
setInterval(computeCpuUsage, 2000);

function getDirectorySizeBytesRecursive(dirPath: string, depth: number, maxDepth: number): number {
  if (depth > maxDepth) return 0;
  let bytes = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          bytes += getDirectorySizeBytesRecursive(full, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          bytes += fs.statSync(full).size;
        }
      } catch {}
    }
  } catch {}
  return bytes;
}

function scanServerDataSizeMb(): number {
  const now = Date.now();
  // Cache directory scan for 60 seconds to prevent disk I/O thrashing
  if (now - lastDiskScan < 60000 && cachedServerDiskUsedMb > 0) {
    return cachedServerDiskUsedMb;
  }

  const dataDir = process.env.DATA_DIR ?? process.env.SERVER_DATA_DIR ?? "/var/rubber-panel/servers";
  if (!fs.existsSync(dataDir)) {
    cachedServerDiskUsedMb = 0;
    lastDiskScan = now;
    return 0;
  }

  try {
    const totalBytes = getDirectorySizeBytesRecursive(dataDir, 0, 6);
    cachedServerDiskUsedMb = Math.round(totalBytes / (1024 * 1024));
    lastDiskScan = now;
  } catch {
    cachedServerDiskUsedMb = 0;
  }

  return cachedServerDiskUsedMb;
}

function getHostDiskStats() {
  try {
    const checkPath = process.platform === "win32" ? process.cwd() : "/";
    const stat = fs.statfsSync(checkPath);
    const totalBytes = Number(stat.blocks) * Number(stat.bsize);
    const freeBytes = Number(stat.bavail) * Number(stat.bsize);
    const usedBytes = totalBytes - freeBytes;

    const diskTotalGb = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(1));
    const diskUsedGb = parseFloat((usedBytes / (1024 * 1024 * 1024)).toFixed(1));
    const diskTotalMb = Math.round(totalBytes / (1024 * 1024));
    const diskUsedMb = Math.round(usedBytes / (1024 * 1024));
    const diskUsage = parseFloat(((usedBytes / (totalBytes || 1)) * 100).toFixed(1));

    return {
      diskTotalGb,
      diskUsedGb,
      diskTotalMb,
      diskUsedMb,
      diskUsage,
    };
  } catch {
    return {
      diskTotalGb: 0,
      diskUsedGb: 0,
      diskTotalMb: 0,
      diskUsedMb: 0,
      diskUsage: 0,
    };
  }
}

export function getNodeResources(): NodeResources {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const ramUsedMb = Math.round(usedMem / 1024 / 1024);
  const ramTotalMb = Math.round(totalMem / 1024 / 1024);
  const ramFreeMb = Math.round(freeMem / 1024 / 1024);
  const ramUsage = parseFloat(((usedMem / totalMem) * 100).toFixed(1));

  const diskStats = getHostDiskStats();
  const serversDiskUsedMb = scanServerDataSizeMb();

  return {
    cpuUsage: parseFloat(cachedCpuUsage.toFixed(1)),
    ramUsage,
    ramUsedMb,
    ramTotalMb,
    ramFreeMb,
    diskUsage: diskStats.diskUsage,
    diskUsedGb: diskStats.diskUsedGb,
    diskTotalGb: diskStats.diskTotalGb,
    diskTotalMb: diskStats.diskTotalMb,
    diskUsedMb: diskStats.diskUsedMb,
    serversDiskUsedMb,
    networkRx: 0,
    networkTx: 0,
    loadAvg: os.loadavg(),
    uptime: os.uptime(),
  };
}

export async function sendHeartbeat(): Promise<void> {
  const adminUrl = process.env.ADMIN_API_URL;
  const nodeToken = process.env.NODE_TOKEN;
  const agentVersion = "1.0.0";

  if (!adminUrl || !nodeToken) {
    console.warn("[Heartbeat] ADMIN_API_URL or NODE_TOKEN not configured");
    return;
  }

  const resources = getNodeResources();

  try {
    const res = await fetch(`${adminUrl}/api/node/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nodeToken}`,
      },
      body: JSON.stringify({
        cpuUsage: resources.cpuUsage,
        ramUsage: resources.ramUsage,
        diskUsage: resources.diskUsage,
        hostTotalRam: resources.ramTotalMb,
        hostUsedRam: resources.ramUsedMb,
        hostTotalDisk: resources.diskTotalMb,
        hostUsedDisk: resources.diskUsedMb,
        serversUsedDisk: resources.serversDiskUsedMb,
        networkRx: resources.networkRx,
        networkTx: resources.networkTx,
        agentVersion,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      console.log(`[Heartbeat] ✓ Sent to admin panel`);
    } else {
      console.warn(`[Heartbeat] ✗ Admin returned ${res.status}`);
    }
  } catch (error) {
    console.error("[Heartbeat] ✗ Failed to reach admin panel:", error);
  }
}
