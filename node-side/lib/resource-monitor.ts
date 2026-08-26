import os from "os";

export interface NodeResources {
  cpuUsage: number;        // percentage 0-100
  ramUsage: number;        // percentage 0-100
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsage: number;       // percentage 0-100
  diskUsedGb: number;
  diskTotalGb: number;
  networkRx: number;       // bytes/sec
  networkTx: number;       // bytes/sec
  loadAvg: number[];
  uptime: number;          // seconds
}

let cachedCpuUsage = 0;
let prevCpuInfo: os.CpuInfo[] | null = null;

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

// Compute immediately and then every 2 seconds
computeCpuUsage();
setInterval(computeCpuUsage, 2000);

export function getNodeResources(): NodeResources {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const ramUsedMb = Math.round(usedMem / 1024 / 1024);
  const ramTotalMb = Math.round(totalMem / 1024 / 1024);
  const ramUsage = (usedMem / totalMem) * 100;

  return {
    cpuUsage: parseFloat(cachedCpuUsage.toFixed(1)),
    ramUsage: parseFloat(ramUsage.toFixed(1)),
    ramUsedMb,
    ramTotalMb,
    diskUsage: 0,
    diskUsedGb: 0,
    diskTotalGb: 0,
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
