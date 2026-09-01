import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const userCreateServerSchema = z.object({
  name: z.string().min(1).max(64),
  ram: z.number().int().min(512),
  cpu: z.number().int().min(25),
  disk: z.number().int().min(1024),
  softwareId: z.string().uuid().optional().nullable().or(z.literal("")),
  softwareVersionId: z.string().uuid().optional().nullable().or(z.literal("")),
});

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
  PUMPKIN: "PUMPKIN",
};

export async function POST(req: NextRequest) {
  let userId: string | null = null;

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (internalSecret && internalSecret === expectedSecret) {
    const { searchParams } = new URL(req.url);
    userId = searchParams.get("userId") || req.headers.get("x-user-id");
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

  const { name, ram, cpu, disk } = parsed.data;
  const cleanSoftwareId = parsed.data.softwareId?.trim() || null;
  const cleanSoftwareVersionId = parsed.data.softwareVersionId?.trim() || null;

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
    const assignedPort = availableAllocation.port;
    const xms = Math.max(128, Math.round(ram * 0.25));

    // Resolve software & version
    let softwareType = "PAPER";
    let softwareVersion = "LATEST";
    let javaVersion = "21";

    if (cleanSoftwareId) {
      const sw = await db.software.findUnique({
        where: { id: cleanSoftwareId },
        include: cleanSoftwareVersionId ? { versions: { where: { id: cleanSoftwareVersionId } } } : { versions: true },
      });
      if (sw) {
        softwareType = itzgTypeMap[sw.type?.toUpperCase()] || (sw.type === "PUMPKIN" || sw.name?.toLowerCase().includes("pumpkin") ? "PUMPKIN" : "PAPER");
        const ver = cleanSoftwareVersionId ? sw.versions?.[0] : sw.versions?.[0];
        if (ver) {
          softwareVersion = ver.version;
          if (ver.version.startsWith("1.21") || ver.version.startsWith("1.20.5") || ver.version.startsWith("1.20.6")) {
            javaVersion = "21";
          } else if (ver.version.startsWith("1.18") || ver.version.startsWith("1.19") || ver.version.startsWith("1.20")) {
            javaVersion = "17";
          } else if (ver.version.startsWith("1.17")) {
            javaVersion = "16";
          } else if (ver.version.startsWith("1.16") || ver.version.startsWith("1.12") || ver.version.startsWith("1.8")) {
            javaVersion = "8";
          }
        }
      }
    }

    const isPumpkin = softwareType === "PUMPKIN" || softwareVersion.toLowerCase().startsWith("pumpkin-");
    const startupCommand = `java -Xms${xms}M -Xmx${ram}M -jar server.jar --nogui`;

    const environment: Record<string, string> = {
      SERVER_TYPE: isPumpkin ? "PUMPKIN" : "MINECRAFT",
      SECURITY_PROTECTION: "true",
      CRYO_SLEEP_ENABLED: "false",
      DOCKER_IMAGE: isPumpkin ? "debian:bookworm-slim" : "itzg/minecraft-server",
      INTERNAL_PORT: "25565",
      EULA: "TRUE",
      TYPE: isPumpkin ? "PUMPKIN" : softwareType,
      VERSION: softwareVersion,
      JAVA_VERSION: javaVersion,
      MEMORY: `${ram}M`,
      JVM_XX_OPTS: `-Xms${xms}M`,
      SERVER_PORT: `${assignedPort}`,
      ENABLE_RCON: "false",
      ENABLE_AUTOPAUSE: "FALSE",
      ONLINE_MODE: "false",
      USE_AIKAR_FLAGS: "true",
    };

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
          serverType: isPumpkin ? "PUMPKIN" : "MINECRAFT",
          softwareId: cleanSoftwareId,
          softwareVersionId: cleanSoftwareVersionId,
          javaVersion,
          environment: JSON.stringify(environment),
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
      const nodeResult = await sendNodeCommand(node.id, "/api/agent/servers", "POST", {
        id: newServer.id,
        name: newServer.name,
        ram,
        cpu,
        disk,
        port: assignedPort,
        startupCommand: newServer.startupCommand,
        environment,
      });

      if (!nodeResult.success) {
        console.warn(`Node agent server create warning on ${node.id}:`, nodeResult.error);
      }
    } catch (nodeErr: any) {
      console.warn(`Node agent unreachable during server create:`, nodeErr?.message);
    }

    await createAuditLog({
      actorId: userId,
      actorEmail: user.email,
      action: "SERVER_CREATED" as any,
      target: newServer.name,
      targetId: newServer.id,
      metadata: { action: "QUOTA_SERVER_SELF_CREATED", ram, cpu, disk, softwareType, softwareVersion },
    });

    return NextResponse.json({
      success: true,
      server: newServer,
      message: `Server "${name}" (${softwareType} ${softwareVersion}) provisioned successfully from your quota pool!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create server from quota" }, { status: 500 });
  }
}
