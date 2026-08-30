import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { sendNodeCommand } from "@/lib/node-client";

// GET /api/admin/sandboxes — List all Code Sandboxes & Dev Environments
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!session?.user || !isAdminRole(actor?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const nodeId = searchParams.get("nodeId");
  const ownerId = searchParams.get("ownerId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {
    OR: [
      { isSandbox: true },
      { serverType: "CODESANDBOX" },
    ],
  };

  if (search) {
    where.name = { contains: search };
  }
  if (nodeId) where.nodeId = nodeId;
  if (ownerId) where.ownerId = ownerId;
  if (status) where.status = status;

  const [sandboxes, total] = await Promise.all([
    db.server.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, username: true, email: true } },
        node: { select: { id: true, name: true, fqdn: true, status: true } },
        allocations: { select: { id: true, ip: true, port: true }, orderBy: { port: "asc" } },
        customImage: { select: { id: true, name: true, dockerImage: true } },
      },
    }),
    db.server.count({ where }),
  ]);

  const runningCount = sandboxes.filter(s => s.status === "RUNNING").length;
  const uniqueUsers = new Set(sandboxes.map(s => s.ownerId)).size;

  return NextResponse.json({
    sandboxes,
    total,
    stats: {
      total,
      running: runningCount,
      stopped: total - runningCount,
      uniqueUsers,
    },
  });
}

// POST /api/admin/sandboxes — Provision a new Code Sandbox for a user
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!session?.user || !isAdminRole(actor?.role ?? "") || !hasPermission(actor?.role as any, PERMISSIONS.SERVERS_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    ownerId,
    nodeId,
    ram = 2048,
    cpu = 100,
    disk = 10240,
    swap = 0,
    allocationId,
    specificPorts,
    sandboxRuntime = "fullstack",
    customImageId,
    dockerImageOverride,
    sandboxDailyHoursLimit = 0, // 0 = unlimited
    sandboxAutoShutdownMinutes = 30, // 0 = disabled
    sandboxPassword,
    expiresAt,
    gracePeriodDays = 3,
    autoSuspendOnExpiry = true,
    autoDeleteOnGraceExpiry = false,
  } = body;

  if (!name || !ownerId || !nodeId) {
    return NextResponse.json({ error: "Name, ownerId, and nodeId are required" }, { status: 400 });
  }

  // Validate Owner
  const owner = await db.user.findUnique({ where: { id: ownerId } });
  if (!owner) return NextResponse.json({ error: "Owner user not found" }, { status: 404 });

  // Validate Node
  const node = await db.node.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  if (node.maintenanceMode) return NextResponse.json({ error: "Node is in maintenance mode" }, { status: 400 });

  // Resolve Allocation / Port
  const allocatedIds: string[] = [];

  // 1. Process specific ports if provided
  if (specificPorts && Array.isArray(specificPorts) && specificPorts.length > 0) {
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

  // 2. Pre-assigned allocation override
  if (allocationId && !allocatedIds.includes(allocationId)) {
    const alloc = await db.allocation.findUnique({ where: { id: allocationId } });
    if (alloc && alloc.nodeId === nodeId && !alloc.assigned && !alloc.disabled) {
      allocatedIds.push(alloc.id);
    }
  }

  // 3. Fallback: select random free allocation or generate next port
  if (allocatedIds.length === 0) {
    const freeAllocations = await db.allocation.findMany({
      where: {
        nodeId,
        assigned: false,
        disabled: false,
        port: { not: 25565 }
      }
    });

    if (freeAllocations.length > 0) {
      const picked = freeAllocations[Math.floor(Math.random() * freeAllocations.length)];
      allocatedIds.push(picked.id);
    } else {
      const rangeStart = Math.max(25566, node.portRangeStart ?? 25566);
      const rangeEnd = Math.max(rangeStart + 200, node.portRangeEnd ?? 29999);

      const usedPorts = await db.allocation.findMany({
        where: { nodeId },
        select: { port: true },
      });
      const usedPortSet = new Set(usedPorts.map(p => p.port));
      usedPortSet.add(25565);

      const pool: number[] = [];
      for (let p = rangeStart; p <= rangeEnd; p++) {
        if (!usedPortSet.has(p)) pool.push(p);
      }

      if (pool.length === 0) {
        return NextResponse.json({ error: "No free ports available on this node" }, { status: 400 });
      }

      const randomP = pool[Math.floor(Math.random() * pool.length)];
      const newAlloc = await db.allocation.create({
        data: {
          nodeId,
          ip: node.fqdn,
          port: randomP,
          assigned: false,
          disabled: false,
        }
      });
      allocatedIds.push(newAlloc.id);
    }
  }

  // Determine Docker Image based on Runtime selection
  let effectiveDockerImage = "codercom/code-server:latest";
  if (dockerImageOverride?.trim()) {
    effectiveDockerImage = dockerImageOverride.trim();
  } else if (customImageId) {
    const cImg = await db.containerImage.findUnique({ where: { id: customImageId } });
    if (cImg?.dockerImage) effectiveDockerImage = cImg.dockerImage;
  } else {
    // Map runtime to specialized code-server stacks or base image
    switch (sandboxRuntime) {
      case "nodejs":
      case "fullstack":
      case "python":
      case "rust":
      case "golang":
      case "java":
      default:
        effectiveDockerImage = "codercom/code-server:latest";
        break;
    }
  }

  const cleanExpiresAt = expiresAt ? new Date(expiresAt) : null;
  const cleanPassword = sandboxPassword?.trim() || null;

  // Create Server entity in database
  const sandbox = await db.server.create({
    data: {
      name,
      ownerId,
      nodeId,
      ram: parseInt(String(ram)),
      cpu: parseInt(String(cpu)),
      disk: parseInt(String(disk)),
      swap: parseInt(String(swap)) || 0,
      serverType: "CODESANDBOX",
      isSandbox: true,
      sandboxRuntime,
      sandboxDailyHoursLimit: parseInt(String(sandboxDailyHoursLimit)) || 0,
      sandboxAutoShutdownMinutes: parseInt(String(sandboxAutoShutdownMinutes)) || 30,
      sandboxPassword: cleanPassword,
      customImageId: customImageId || null,
      allowedPaths: "[\"/\"]",
      protectedPaths: "[]",
      blockedUploadPaths: "[]",
      allowNodeTransfer: false,
      allowGoogleDriveBackups: true,
      cryoSleepEnabled: false,
      expiresAt: cleanExpiresAt,
      gracePeriodDays: parseInt(String(gracePeriodDays)) || 3,
      autoSuspendOnExpiry: Boolean(autoSuspendOnExpiry),
      autoDeleteOnGraceExpiry: Boolean(autoDeleteOnGraceExpiry),
      status: "OFFLINE",
    },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      node: { select: { id: true, name: true, fqdn: true } },
    }
  });

  // Assign Allocation to Sandbox
  const assignedAllocations: { id: string; port: number; ip: string }[] = [];
  for (let i = 0; i < allocatedIds.length; i++) {
    const alloc = await db.allocation.update({
      where: { id: allocatedIds[i] },
      data: { assigned: true, serverId: sandbox.id },
    });
    assignedAllocations.push(alloc);
  }

  const assignedPort = assignedAllocations[0]?.port ?? 25590;

  // Build node environment configuration
  const environment: Record<string, string> = {
    IS_SANDBOX: "true",
    SERVER_TYPE: "CODESANDBOX",
    SANDBOX_RUNTIME: sandboxRuntime,
    SANDBOX_PASSWORD: cleanPassword || "",
    DOCKER_IMAGE: effectiveDockerImage,
    INTERNAL_PORT: "8080",
    SERVER_PORT: String(assignedPort),
  };

  await db.server.update({
    where: { id: sandbox.id },
    data: { environment: JSON.stringify(environment) },
  });

  // Provision container workspace on Node Daemon
  try {
    await sendNodeCommand(nodeId, "/api/agent/servers", "POST", {
      id: sandbox.id,
      name: sandbox.name,
      ram: sandbox.ram,
      cpu: sandbox.cpu,
      disk: sandbox.disk,
      port: assignedPort,
      environment,
      startupCommand: undefined,
    });
  } catch (err: any) {
    console.error("[AdminSandboxes] Failed to dispatch creation to node daemon:", err);
  }

  // Audit log
  await createAuditLog({
    actorId: actor?.id ?? "unknown",
    actorEmail: actor?.email ?? "unknown",
    action: "CODESANDBOX_CREATE",
    target: "SERVER",
    targetId: sandbox.id,
    metadata: {
      name: sandbox.name,
      owner: owner.username,
      node: node.name,
      runtime: sandboxRuntime,
      port: assignedPort,
      dailyHoursLimit: sandbox.sandboxDailyHoursLimit,
      autoShutdownMinutes: sandbox.sandboxAutoShutdownMinutes,
    },
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({
    success: true,
    sandbox: {
      ...sandbox,
      port: assignedPort,
      allocations: assignedAllocations,
    },
  }, { status: 201 });
}
