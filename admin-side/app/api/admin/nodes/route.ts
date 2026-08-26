import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { generateNodeToken } from "@/lib/auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
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
      portRangeStart: true, portRangeEnd: true,
      autoStartServersOnBoot: true,
      bootCryoSleepMode: true,
      bootGracePeriodSeconds: true,
      maxConcurrentBootStarts: true,
      bootStartupDelaySeconds: true,
      createdAt: true,
      _count: { select: { servers: true, allocations: true } },
    },
  });

  const nodes = rawNodes.map(node => {
    const isRecent = node.lastHeartbeat && (now.getTime() - new Date(node.lastHeartbeat).getTime() <= 60000);
    const computedStatus = node.maintenanceMode ? "MAINTENANCE" : isRecent ? "ONLINE" : "OFFLINE";
    return {
      ...node,
      status: computedStatus,
      isOnline: computedStatus === "ONLINE",
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

  return NextResponse.json(node, { status: 201 });
}
