import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";
import { z } from "zod";

const createServerSchema = z.object({
  name: z.string().min(1).max(64),
  ownerId: z.string().uuid(),
  nodeId: z.string().uuid(),
  ram: z.number().int().min(128),
  cpu: z.number().int().min(1).max(400),
  disk: z.number().int().min(512),
  swap: z.number().int().min(0).default(0),
  softwareId: z.string().uuid().optional().nullable().or(z.literal("")),
  softwareVersionId: z.string().uuid().optional().nullable().or(z.literal("")),
  templateId: z.string().uuid().optional().nullable().or(z.literal("")),
  startupCommand: z.string().optional(),
  allocationId: z.string().uuid().optional().nullable().or(z.literal("")),
  portCount: z.number().int().min(1).max(20).default(1),
  specificPorts: z.array(z.number().int()).optional(),
  allowFileUploads: z.boolean().default(true),
  allowedPaths: z.string().optional(),
  protectedPaths: z.string().optional(),
  blockedUploadPaths: z.string().optional(),
  allowNodeTransfer: z.boolean().default(false),
  allowGoogleDriveBackups: z.boolean().default(true),
  cryoSleepEnabled: z.boolean().default(false),
  cryoSleepIdleMinutes: z.number().int().min(1).max(1440).default(10),
  cryoSleepCustomMotdAllowed: z.boolean().default(true),
  cryoSleepMotd: z.string().optional().nullable(),
  serverType: z.string().default("MINECRAFT"),
  nodeVersion: z.string().optional(),
  securityProtection: z.boolean().default(true),
  javaVersion: z.string().optional(),
  javaVersionId: z.string().uuid().optional().nullable().or(z.literal("")),
  customImageId: z.string().uuid().optional().nullable().or(z.literal("")),
  expiresAt: z.string().optional().nullable(),
  gracePeriodDays: z.number().int().min(0).max(365).default(3),
  autoSuspendOnExpiry: z.boolean().default(true),
  autoDeleteOnGraceExpiry: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const isInternal = Boolean(internalSecret && expectedSecret && internalSecret === expectedSecret);

  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!isInternal && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const nodeId = searchParams.get("nodeId");
  const ownerId = searchParams.get("ownerId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const where: Record<string, unknown> = {};
  if (search) where.name = { contains: search };
  if (nodeId) where.nodeId = nodeId;
  if (ownerId) where.ownerId = ownerId;
  if (status) where.status = status;

  const [servers, total] = await Promise.all([
    db.server.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, status: true, suspended: true,
        ram: true, cpu: true, disk: true, swap: true,
        serverType: true, nodeVersion: true,
        securityProtection: true, securitySuspendedUntil: true, securityQuarantineReason: true,
        javaVersion: true, javaVersionId: true, customImageId: true,
        customImage: { select: { id: true, name: true, dockerImage: true, icon: true, category: true } },
        allowNodeTransfer: true, allowGoogleDriveBackups: true,
        cryoSleepEnabled: true, cryoSleepIdleMinutes: true, cryoSleepCustomMotdAllowed: true, cryoSleepMotd: true,
        expiresAt: true, gracePeriodDays: true,
        autoSuspendOnExpiry: true, autoDeleteOnGraceExpiry: true,
        suspensionReason: true,
        createdAt: true, uuid: true,
        owner: { select: { id: true, username: true, email: true } },
        node: { select: { id: true, name: true, status: true } },
        software: { select: { name: true, type: true } },
        allocations: { select: { id: true, ip: true, port: true } },
      },
    }),
    db.server.count({ where }),
  ]);

  return NextResponse.json({ servers, total, page, limit });
}

export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const isInternal = Boolean(internalSecret && expectedSecret && internalSecret === expectedSecret);

  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined ?? {
    id: "system-internal",
    email: "system@rubberlab.net",
    role: "ADMIN",
  };

  if (!isInternal && (!session?.user || !isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SERVERS_CREATE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const { ownerId, nodeId, allocationId, portCount, specificPorts, ...rest } = parsed.data;

  // Validate owner exists
  const owner = await db.user.findUnique({ where: { id: ownerId } });
  if (!owner) return NextResponse.json({ error: "Owner user not found" }, { status: 404 });

  // Validate node exists and is online
  const node = await db.node.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  if (node.maintenanceMode) return NextResponse.json({ error: "Node is in maintenance mode" }, { status: 400 });

  const totalPortsNeeded = Math.max(1, portCount || 1);
  const allocatedIds: string[] = [];

  // Primary allocation
  if (allocationId) {
    const alloc = await db.allocation.findUnique({ where: { id: allocationId } });
    if (!alloc || alloc.nodeId !== nodeId || alloc.assigned || alloc.disabled) {
      return NextResponse.json({ error: "Selected primary allocation is unavailable or invalid" }, { status: 400 });
    }
    allocatedIds.push(alloc.id);
  } else {
    // Pick an available, non-disabled, non-25565 allocation
    const freeAllocation = await db.allocation.findFirst({
      where: { 
        nodeId, 
        assigned: false,
        disabled: false,
        port: { not: 25565 }
      },
      orderBy: { port: "asc" },
    });
    
    if (freeAllocation) {
      allocatedIds.push(freeAllocation.id);
    } else {
      // Generate a new random port
      const rangeStart = Math.max(25566, node.portRangeStart ?? 25566);
      const rangeEnd = Math.max(rangeStart + 100, node.portRangeEnd ?? 29999);
      
      const usedPorts = await db.allocation.findMany({
        where: { nodeId },
        select: { port: true },
      });
      const usedPortSet = new Set(usedPorts.map(p => p.port));
      usedPortSet.add(25565);
      
      let nextPort = -1;
      const pool: number[] = [];
      for (let p = rangeStart; p <= rangeEnd; p++) {
        if (!usedPortSet.has(p)) pool.push(p);
      }
      if (pool.length > 0) {
        nextPort = pool[Math.floor(Math.random() * pool.length)];
      }
      
      if (nextPort === -1) {
        return NextResponse.json({ error: "No free ports available on this node" }, { status: 400 });
      }
      
      const newAlloc = await db.allocation.create({
        data: {
          nodeId,
          ip: node.fqdn,
          port: nextPort,
          assigned: false,
          disabled: false,
        },
      });
      allocatedIds.push(newAlloc.id);
    }
  }

  // Allocate specific ports if provided
  if (specificPorts && Array.isArray(specificPorts)) {
    for (const p of specificPorts) {
      if (typeof p === "number" && p >= 1024 && p <= 65535) {
        let alloc = await db.allocation.findFirst({
          where: { nodeId, port: p }
        });
        if (!alloc) {
          alloc = await db.allocation.create({
            data: { nodeId, ip: node.fqdn, port: p, assigned: false, disabled: false }
          });
        }
        if (!alloc.assigned && !alloc.disabled && !allocatedIds.includes(alloc.id)) {
          allocatedIds.push(alloc.id);
        }
      }
    }
  }

  // Allocate remaining ports to fulfill portCount
  while (allocatedIds.length < totalPortsNeeded) {
    const freeAlloc = await db.allocation.findFirst({
      where: {
        nodeId,
        assigned: false,
        disabled: false,
        port: { not: 25565 },
        id: { notIn: allocatedIds },
      },
      orderBy: { port: "asc" },
    });

    if (freeAlloc) {
      allocatedIds.push(freeAlloc.id);
    } else {
      // Generate a new port
      const rangeStart = Math.max(25566, node.portRangeStart ?? 25566);
      const rangeEnd = Math.max(rangeStart + 200, node.portRangeEnd ?? 29999);
      
      const usedPorts = await db.allocation.findMany({
        where: { nodeId },
        select: { port: true },
      });
      const usedPortSet = new Set(usedPorts.map(p => p.port));
      usedPortSet.add(25565);

      let nextP = -1;
      for (let p = rangeStart; p <= rangeEnd; p++) {
        if (!usedPortSet.has(p)) {
          nextP = p;
          break;
        }
      }
      if (nextP === -1) break;

      const newAlloc = await db.allocation.create({
        data: {
          nodeId,
          ip: node.fqdn,
          port: nextP,
          assigned: false,
          disabled: false,
        }
      });
      allocatedIds.push(newAlloc.id);
    }
  }

  // Clean empty strings to null for optional foreign keys and dates
  const cleanSoftwareId = rest.softwareId?.trim() ? rest.softwareId.trim() : null;
  const cleanSoftwareVersionId = rest.softwareVersionId?.trim() ? rest.softwareVersionId.trim() : null;
  const cleanTemplateId = rest.templateId?.trim() ? rest.templateId.trim() : null;
  const cleanJavaVersionId = rest.javaVersionId?.trim() ? rest.javaVersionId.trim() : null;
  const cleanCustomImageId = rest.customImageId?.trim() ? rest.customImageId.trim() : null;
  const cleanExpiresAt = rest.expiresAt ? new Date(rest.expiresAt) : null;

  let customImg = null;
  if (cleanCustomImageId) {
    customImg = await db.containerImage.findUnique({ where: { id: cleanCustomImageId } });
  }

  // Create server in database
  const server = await db.server.create({
    data: {
      name: rest.name,
      ram: rest.ram,
      cpu: rest.cpu,
      disk: rest.disk,
      swap: rest.swap,
      serverType: customImg ? (customImg.category === "DATABASE" ? "DATABASE" : customImg.name.toUpperCase().includes("PYTHON") ? "PYTHON" : customImg.name.toUpperCase().includes("RUST") ? "RUST" : "CUSTOM") : (rest.serverType || "MINECRAFT"),
      nodeVersion: rest.nodeVersion || "20",
      securityProtection: rest.securityProtection !== false,
      softwareId: cleanSoftwareId,
      softwareVersionId: cleanSoftwareVersionId,
      templateId: cleanTemplateId,
      javaVersion: rest.javaVersion || "21",
      javaVersionId: cleanJavaVersionId,
      customImageId: cleanCustomImageId,
      startupCommand: rest.startupCommand || (customImg?.defaultStartup ?? null),
      allowedPaths: rest.allowedPaths || "[\"/\"]",
      protectedPaths: rest.protectedPaths || "[]",
      blockedUploadPaths: rest.blockedUploadPaths || "[]",
      allowNodeTransfer: Boolean(rest.allowNodeTransfer),
      allowGoogleDriveBackups: rest.allowGoogleDriveBackups !== false,
      cryoSleepEnabled: Boolean(rest.cryoSleepEnabled),
      cryoSleepIdleMinutes: rest.cryoSleepIdleMinutes ?? 10,
      cryoSleepCustomMotdAllowed: rest.cryoSleepCustomMotdAllowed !== false,
      cryoSleepMotd: rest.cryoSleepMotd || null,
      expiresAt: cleanExpiresAt,
      gracePeriodDays: rest.gracePeriodDays ?? 3,
      autoSuspendOnExpiry: rest.autoSuspendOnExpiry !== false,
      autoDeleteOnGraceExpiry: Boolean(rest.autoDeleteOnGraceExpiry),
      ownerId,
      nodeId,
      status: "OFFLINE",
    },
    select: {
      id: true, name: true, uuid: true, status: true,
      ram: true, cpu: true, disk: true, createdAt: true,
      owner: { select: { username: true, email: true } },
      node: { select: { name: true } },
    },
  });

  // Assign ALL allocated ports to this server
  let assignedPort = 25566;
  for (let i = 0; i < allocatedIds.length; i++) {
    const alloc = await db.allocation.update({
      where: { id: allocatedIds[i] },
      data: { assigned: true, serverId: server.id },
    });
    if (i === 0) {
      assignedPort = alloc.port;
    }
  }

  // Find template docker image if applicable
  let dockerImage = "itzg/minecraft-server";
  if (cleanTemplateId) {
    const tpl = await db.template.findUnique({ where: { id: cleanTemplateId } });
    if (tpl?.dockerImage) dockerImage = tpl.dockerImage;
  }

  const itzgTypeMap: Record<string, string> = {
    VANILLA: "VANILLA",
    PAPER: "PAPER",
    PURPUR: "PURPUR",
    FABRIC: "FABRIC",
    FORGE: "FORGE",
    NEOFORGE: "NEOFORGE",
    QUILT: "QUILT",
    FOLIA: "FOLIA",
    MOHIST: "MOHIST",
    ARCLIGHT: "ARCLIGHT",
    MAGMA: "MAGMA",
    SPIGOT: "SPIGOT",
    BUNGEECORD: "BUNGEECORD",
    VELOCITY: "VELOCITY",
    WATERFALL: "WATERFALL",
    CURSEFORGE: "CURSEFORGE",
    MODRINTH: "MODRINTH",
    CUSTOM: "CUSTOM",
  };

  let softwareType = "PAPER";
  let softwareVersion = "LATEST";

  if (cleanSoftwareId) {
    const sw = await db.software.findUnique({
      where: { id: cleanSoftwareId },
      include: cleanSoftwareVersionId ? { versions: { where: { id: cleanSoftwareVersionId } } } : { versions: true },
    });
    if (sw) {
      softwareType = itzgTypeMap[sw.type] ?? "PAPER";
      const ver = cleanSoftwareVersionId ? sw.versions?.[0] : null;
      if (ver) softwareVersion = ver.version;
    }
  }

  const ramMb = rest.ram;
  const xms = Math.max(128, Math.round(ramMb * 0.25));

  const isNodeJs = rest.serverType === "NODEJS";
  const isCustomImage = Boolean(customImg);

  let customParsedEnv: Record<string, string> = {};
  if (customImg?.environment) {
    try {
      customParsedEnv = JSON.parse(customImg.environment);
    } catch {}
  }

  const environment: Record<string, string> = {
    SERVER_TYPE: customImg ? (customImg.category === "DATABASE" ? "DATABASE" : customImg.name.toUpperCase().includes("PYTHON") ? "PYTHON" : customImg.name.toUpperCase().includes("RUST") ? "RUST" : "CUSTOM") : (rest.serverType || "MINECRAFT"),
    NODE_VERSION: rest.nodeVersion || "20",
    SECURITY_PROTECTION: String(rest.securityProtection !== false),
    CRYO_SLEEP_ENABLED: String(Boolean(rest.cryoSleepEnabled)),
    CRYO_SLEEP_IDLE_MINUTES: String(rest.cryoSleepIdleMinutes ?? 10),
    CRYO_SLEEP_MOTD: rest.cryoSleepMotd || "",
    DOCKER_IMAGE: isCustomImage ? customImg!.dockerImage : isNodeJs ? `node:${rest.nodeVersion || "20"}-alpine` : dockerImage,
    INTERNAL_PORT: isCustomImage ? String(customImg!.internalPort || 8080) : isNodeJs ? "3000" : "25565",
    EULA: "TRUE",
    TYPE: isCustomImage ? "CUSTOM" : isNodeJs ? "NODEJS" : softwareType,
    VERSION: isNodeJs ? (rest.nodeVersion || "20") : softwareVersion,
    JAVA_VERSION: rest.javaVersion || "21",
    MEMORY: `${ramMb}M`,
    JVM_XX_OPTS: `-Xms${xms}M`,
    SERVER_PORT: `${assignedPort}`,
    ENABLE_RCON: isNodeJs || isCustomImage ? "false" : "true",
    RCON_PASSWORD: `rp-${server.id.slice(0, 8)}`,
    RCON_PORT: "25575",
    ONLINE_MODE: "false",
    USE_AIKAR_FLAGS: isNodeJs || isCustomImage ? "false" : "true",
    ...customParsedEnv,
    ...(rest.startupCommand && (softwareType === "CUSTOM" || isCustomImage) ? { CUSTOM_SERVER: rest.startupCommand } : {}),
  };

  // Tell the node agent to create the server files & directories (WITHOUT auto-starting it)
  try {
    const nodeResult = await sendNodeCommand(nodeId, `/api/agent/servers`, "POST", {
      id: server.id,
      name: server.name,
      ram: rest.ram,
      cpu: rest.cpu,
      disk: rest.disk,
      port: assignedPort,
      startupCommand: rest.startupCommand,
      environment,
    });

    if (!nodeResult.success) {
      console.warn(`Node agent server create warning on ${nodeId}:`, nodeResult.error);
    }
  } catch (nodeErr: any) {
    console.warn(`Node agent unreachable during server create:`, nodeErr?.message);
  }

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "SERVER_CREATED",
    target: server.name, targetId: server.id,
    ipAddress: getIpFromRequest(request),
    metadata: { name: server.name, ownerId, nodeId, ram: rest.ram, cpu: rest.cpu, port: assignedPort, totalPorts: allocatedIds.length },
  });

  return NextResponse.json(server, { status: 201 });
}
