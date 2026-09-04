import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { generateNodeToken } from "@/lib/auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { createSetupToken } from "@/lib/node-setup-tokens";
import { z } from "zod";


const createNodeSchema = z.object({
  name: z.string().min(1).max(64),
  fqdn: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(8080),
  location: z.string().optional(),
  description: z.string().optional(),
  maxCpu: z.number().int().min(1).max(100).optional(),
  maxRam: z.number().int().min(256).optional(),
  maxDisk: z.number().int().min(1024).optional(),
  portRangeStart: z.number().int().min(1024).optional(),
  portRangeEnd: z.number().int().max(65535).optional(),
  autoStartServersOnBoot: z.boolean().optional(),
  bootCryoSleepMode: z.enum(["CRYO_HIBERNATE_ALL", "RESTORE_PREVIOUS", "DO_NOTHING"]).optional(),
  bootGracePeriodSeconds: z.number().int().min(0).max(600).optional(),
  maxConcurrentBootStarts: z.number().int().min(1).max(20).optional(),
  bootStartupDelaySeconds: z.number().int().min(0).max(60).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  // Auto-mark stale nodes as OFFLINE in the database
  await db.node.updateMany({
    where: {
      status: "ONLINE",
      OR: [
        { lastHeartbeat: null },
        { lastHeartbeat: { lt: oneMinuteAgo } },
      ],
    },
    data: { status: "OFFLINE" },
  });

  const rawNodes = await db.node.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, fqdn: true, port: true, location: true,
      description: true, status: true, maintenanceMode: true,
      agentVersion: true, lastHeartbeat: true,
      cpuUsage: true, ramUsage: true, diskUsage: true, networkRx: true, networkTx: true,
      maxCpu: true, maxRam: true, maxDisk: true,
      hostTotalRam: true, hostUsedRam: true, hostTotalDisk: true, hostUsedDisk: true,
      serversUsedDisk: true, serversUsedRam: true,
      portRangeStart: true, portRangeEnd: true,
      autoStartServersOnBoot: true,
      bootCryoSleepMode: true,
      bootGracePeriodSeconds: true,
      maxConcurrentBootStarts: true,
      bootStartupDelaySeconds: true,
      createdAt: true,
      servers: {
        select: { id: true, status: true, ram: true, disk: true, cpu: true, cryoSleepEnabled: true }
      },
      _count: { select: { servers: true, allocations: true } },
    },
  });

  const nodes = rawNodes.map(node => {
    const isRecent = node.lastHeartbeat && (now.getTime() - new Date(node.lastHeartbeat).getTime() <= 60000);
    const computedStatus = node.maintenanceMode ? "MAINTENANCE" : isRecent ? "ONLINE" : "OFFLINE";

    const totalAllocatedRam = node.servers.reduce((sum, s) => sum + (s.ram || 0), 0);
    const totalAllocatedDisk = node.servers.reduce((sum, s) => sum + (s.disk || 0), 0);
    const serversRunning = node.servers.filter(s => s.status === "RUNNING").length;
    const serversCryo = node.servers.filter(s => s.status === "SLEEPING" || s.status === "CRYO_SLEEP" || s.status === "HIBERNATED").length;
    const serversStopped = node.servers.filter(s => s.status === "STOPPED" || s.status === "OFFLINE" || s.status === "SUSPENDED").length;

    // Real RAM saved by Cryo-Sleep (all hibernating instances contribute 0 MB active load)
    const cryoRamSavedMb = node.servers
      .filter(s => s.status === "SLEEPING" || s.status === "CRYO_SLEEP" || s.status === "HIBERNATED")
      .reduce((sum, s) => sum + (s.ram || 0), 0);

    // Automatic Allocatable Capacity when left blank / unmetered (Total RAM - 1024 MB for OS)
    const isAutoRam = !node.maxRam || node.maxRam <= 0;
    const effectiveMaxRam = !isAutoRam
      ? (node.maxRam as number)
      : Math.max(1024, (node.hostTotalRam || 8192) - 1024);

    const isAutoDisk = !node.maxDisk || node.maxDisk <= 0;
    const effectiveMaxDisk = !isAutoDisk
      ? (node.maxDisk as number)
      : Math.max(1024, (node.hostTotalDisk || 102400) - 5120);

    const ramAllocatedPercent = Math.round((totalAllocatedRam / (effectiveMaxRam || 1)) * 100);
    const diskAllocatedPercent = Math.round((totalAllocatedDisk / (effectiveMaxDisk || 1)) * 100);
    const hostRamUsagePct = node.ramUsage ?? (node.hostTotalRam && node.hostUsedRam ? Math.round((node.hostUsedRam / node.hostTotalRam) * 100) : 0);
    const hostDiskUsagePct = node.diskUsage ?? (node.hostTotalDisk && node.hostUsedDisk ? Math.round((node.hostUsedDisk / node.hostTotalDisk) * 100) : 0);
    const hostCpuUsagePct = node.cpuUsage ?? 0;

    return {
      id: node.id,
      name: node.name,
      fqdn: node.fqdn,
      port: node.port,
      location: node.location,
      description: node.description,
      status: computedStatus,
      isOnline: computedStatus === "ONLINE",
      maintenanceMode: node.maintenanceMode,
      agentVersion: node.agentVersion,
      lastHeartbeat: node.lastHeartbeat,
      cpuUsage: hostCpuUsagePct,
      ramUsage: hostRamUsagePct,
      diskUsage: hostDiskUsagePct,
      networkRx: node.networkRx,
      networkTx: node.networkTx,
      maxCpu: node.maxCpu,
      maxRam: node.maxRam,
      maxDisk: node.maxDisk,
      effectiveMaxRam,
      effectiveMaxDisk,
      isAutoRam,
      isAutoDisk,
      hostTotalRam: node.hostTotalRam ?? null,
      hostUsedRam: node.hostUsedRam ?? null,
      hostTotalDisk: node.hostTotalDisk ?? null,
      hostUsedDisk: node.hostUsedDisk ?? null,
      serversUsedDisk: node.serversUsedDisk ?? null,
      serversUsedRam: node.serversUsedRam ?? null,
      portRangeStart: node.portRangeStart,
      portRangeEnd: node.portRangeEnd,
      autoStartServersOnBoot: node.autoStartServersOnBoot,
      bootCryoSleepMode: node.bootCryoSleepMode,
      bootGracePeriodSeconds: node.bootGracePeriodSeconds,
      maxConcurrentBootStarts: node.maxConcurrentBootStarts,
      bootStartupDelaySeconds: node.bootStartupDelaySeconds,
      createdAt: node.createdAt,
      totalAllocatedRam,
      totalAllocatedDisk,
      serversRunning,
      serversCryo,
      serversStopped,
      cryoRamSavedMb,
      ramUsedPercent: hostRamUsagePct,
      ramAllocatedPercent,
      diskUsedPercent: hostDiskUsagePct,
      diskAllocatedPercent,
      isRamWarning: hostRamUsagePct >= 80,
      isRamCritical: hostRamUsagePct >= 92,
      isRamOverallocated: totalAllocatedRam > effectiveMaxRam,
      isCpuWarning: hostCpuUsagePct >= 85,
      isDiskWarning: hostDiskUsagePct >= 85,
      _count: node._count,
    };
  });

  return NextResponse.json({ nodes });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.NODES_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  const body = await request.json();
  const parsed = createNodeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const authToken = await generateNodeToken();

  const node = await db.node.create({
    data: { ...parsed.data, authToken, status: "OFFLINE" },
    select: {
      id: true, name: true, fqdn: true, port: true, location: true,
      description: true, status: true, authToken: true, createdAt: true,
    },
  });

  await createAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "NODE_CREATED",
    target: node.name,
    targetId: node.id,
    ipAddress: getIpFromRequest(request),
    metadata: { name: node.name, fqdn: node.fqdn },
  });

  const setupToken = createSetupToken({
    nodeId: node.id,
    authToken: node.authToken,
    port: node.port,
    ttlMinutes: 15,
  });

  return NextResponse.json({ ...node, setupToken }, { status: 201 });
}
