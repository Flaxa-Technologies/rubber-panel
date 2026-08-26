import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string }> };

function verifyInternalSecret(request: NextRequest): string | null {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  if (!expectedSecret || internalSecret !== expectedSecret || !userId) return null;
  return userId;
}

const itzgTypeMap: Record<string, string> = {
  VANILLA: "VANILLA", PAPER: "PAPER", PURPUR: "PURPUR", FABRIC: "FABRIC",
  FORGE: "FORGE", NEOFORGE: "NEOFORGE", QUILT: "QUILT", FOLIA: "FOLIA",
  MOHIST: "MOHIST", ARCLIGHT: "ARCLIGHT", MAGMA: "MAGMA",
  SPIGOT: "SPIGOT", BUNGEECORD: "BUNGEECORD", VELOCITY: "VELOCITY",
  WATERFALL: "WATERFALL", CURSEFORGE: "CURSEFORGE", MODRINTH: "MODRINTH", CUSTOM: "CUSTOM",
};

// POST /api/user/servers/[id]/reinstall — Wipe + reinstall (ownership verified)
export async function POST(request: NextRequest, context: RouteContext) {
  const userId = verifyInternalSecret(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const server = await db.server.findFirst({
    where: { id, ownerId: userId },
    include: {
      node: { select: { id: true } },
      software: { select: { type: true } },
      softwareVersion: { select: { version: true } },
      allocations: { take: 1, orderBy: { port: "asc" } },
    },
  });
  if (!server) return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });

  // Stop if running
  await sendNodeCommand(server.node.id, `/api/agent/servers/${id}`, "POST", { action: "stop" });

  // Delete server files
  await sendNodeCommand(server.node.id, `/api/agent/servers/${id}`, "DELETE");

  // Re-provision
  const softwareType = server.software ? itzgTypeMap[server.software.type] ?? "PAPER" : "PAPER";
  const softwareVersion = server.softwareVersion?.version ?? "LATEST";
  const port = server.allocations[0]?.port ?? 25565;
  const xms = Math.max(128, Math.round(server.ram * 0.25));

  const environment: Record<string, string> = {
    DOCKER_IMAGE: "itzg/minecraft-server",
    EULA: "TRUE",
    TYPE: softwareType,
    VERSION: softwareVersion,
    MEMORY: `${server.ram}M`,
    JVM_XX_OPTS: `-Xms${xms}M`,
    ENABLE_RCON: "true",
    RCON_PASSWORD: `rp-${server.id.slice(0, 8)}`,
    RCON_PORT: "25575",
    ONLINE_MODE: "false",
    USE_AIKAR_FLAGS: "true",
  };

  const nodeResult = await sendNodeCommand(server.node.id, `/api/agent/servers`, "POST", {
    id: server.id,
    name: server.name,
    ram: server.ram,
    cpu: server.cpu,
    disk: server.disk,
    port,
    environment,
  });

  if (!nodeResult.success) {
    return NextResponse.json({ error: "Reinstall failed on node: " + nodeResult.error }, { status: 503 });
  }

  await db.server.update({ where: { id }, data: { status: "OFFLINE" } });
  return NextResponse.json({ success: true });
}
