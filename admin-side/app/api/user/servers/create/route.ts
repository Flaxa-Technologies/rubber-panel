import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { getNodeBaseUrl } from "@/lib/node-client";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const userCreateServerSchema = z.object({
  name: z.string().min(1).max(64),
  ram: z.number().int().min(512),
  cpu: z.number().int().min(25),
  disk: z.number().int().min(1024),
  softwareId: z.string().uuid().optional(),
  softwareVersionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  let userId: string | null = null;

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (internalSecret && internalSecret === expectedSecret) {
    const { searchParams } = new URL(req.url);
    userId = searchParams.get("userId");
  } else {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = userCreateServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, ram, cpu, disk, softwareId, softwareVersionId } = parsed.data;

  try {
    const [user, quota] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        include: { servers: true },
      }),
      db.userResourceQuota.findUnique({
        where: { userId },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!quota) {
      return NextResponse.json({
        error: "Server creation is disabled: No resource quota pool assigned to your account. Please contact an administrator.",
      }, { status: 403 });
    }

    if (!quota.allowServerCreation) {
      return NextResponse.json({
        error: "Server self-creation is not enabled for your account. You can use your quota to expand existing servers.",
      }, { status: 403 });
    }

    if (quota.isSuspended) {
      return NextResponse.json({ error: "Your resource quota is currently suspended." }, { status: 403 });
    }

    if (quota.expiresAt && new Date(quota.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Your resource quota subscription has expired." }, { status: 403 });
    }

    const currentServerCount = user.servers.length;
    if (currentServerCount >= quota.maxServers) {
      return NextResponse.json({
        error: `Server limit reached. Your account quota allows a maximum of ${quota.maxServers} server(s).`,
      }, { status: 400 });
    }

    const totalUsedRam = user.servers.reduce((acc, s) => acc + s.ram, 0);
    const totalUsedCpu = user.servers.reduce((acc, s) => acc + s.cpu, 0);
    const totalUsedDisk = user.servers.reduce((acc, s) => acc + s.disk, 0);

    if (totalUsedRam + ram > quota.maxRam) {
      return NextResponse.json({
        error: `Insufficient Memory quota. Requested ${ram} MB exceeds remaining ${(quota.maxRam - totalUsedRam)} MB.`,
      }, { status: 400 });
    }

    if (totalUsedCpu + cpu > quota.maxCpu) {
      return NextResponse.json({
        error: `Insufficient CPU quota. Requested ${cpu}% exceeds remaining ${(quota.maxCpu - totalUsedCpu)}%.`,
      }, { status: 400 });
    }

    if (totalUsedDisk + disk > quota.maxDisk) {
      return NextResponse.json({
        error: `Insufficient Disk quota. Requested ${disk} MB exceeds remaining ${(quota.maxDisk - totalUsedDisk)} MB.`,
      }, { status: 400 });
    }

    // Find an online node with free allocations
    const availableAllocation = await db.allocation.findFirst({
      where: {
        assigned: false,
        disabled: false,
        node: { status: "ONLINE" },
      },
      include: { node: true },
    });

    if (!availableAllocation) {
      return NextResponse.json({
        error: "No available port allocations on online nodes. Please contact administrator.",
      }, { status: 503 });
    }

    const node = availableAllocation.node;
    const xms = Math.max(128, Math.round(ram * 0.25));
    const startupCommand = `java -Xms${xms}M -Xmx${ram}M -jar server.jar --nogui`;

    // Create server in database transaction
    const newServer = await db.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          name,
          ownerId: userId,
          nodeId: node.id,
          ram,
          cpu,
          disk,
          baseRam: 0,
          baseCpu: 0,
          baseDisk: 0,
          extraRam: ram,
          extraCpu: cpu,
          extraDisk: disk,
          isCreatedFromQuota: true,
          softwareId: softwareId || null,
          softwareVersionId: softwareVersionId || null,
          startupCommand,
          allowNodeTransfer: false,
          quotaId: quota.id,
          expiresAt: quota.expiresAt,
          gracePeriodDays: quota.gracePeriodDays,
          autoSuspendOnExpiry: true,
          status: "STOPPED",
        },
      });

      await tx.allocation.update({
        where: { id: availableAllocation.id },
        data: {
          assigned: true,
          serverId: server.id,
        },
      });

      return server;
    });

    // Notify node daemon to initialize server workspace
    try {
      const nodeUrl = getNodeBaseUrl(node);
      await fetch(`${nodeUrl}/api/agent/servers/${newServer.id}/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${node.authToken}`,
        },
        body: JSON.stringify({
          serverName: newServer.name,
          port: availableAllocation.port,
          ram,
          cpu,
          disk,
        }),
      });
    } catch {}

    await createAuditLog({
      actorId: userId,
      actorEmail: user.email,
      action: "SERVER_CREATED" as any,
      target: newServer.name,
      targetId: newServer.id,
      metadata: { action: "QUOTA_SERVER_SELF_CREATED", ram, cpu, disk },
    });

    return NextResponse.json({
      success: true,
      server: newServer,
      message: `Server "${name}" created successfully from your quota pool!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create server from quota" }, { status: 500 });
  }
}
