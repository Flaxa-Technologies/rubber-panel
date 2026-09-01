import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/servers/[id]/reinstall — Wipe server files and re-create
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  const server = await db.server.findUnique({
    where: { id },
    include: {
      node: { select: { id: true } },
      software: { select: { type: true } },
      softwareVersion: { select: { version: true } },
      allocations: { take: 1, orderBy: { port: "asc" } },
    },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  // 1. Stop the server if running
  await sendNodeCommand(server.node.id, `/api/agent/servers/${id}`, "POST", { action: "stop" });

  // 2. Delete the server files on the node
  await sendNodeCommand(server.node.id, `/api/agent/servers/${id}`, "DELETE");

  // 3. Re-create — re-provision with same config
  const itzgTypeMap: Record<string, string> = {
    VANILLA: "VANILLA", PAPER: "PAPER", PURPUR: "PURPUR", FABRIC: "FABRIC",
    FORGE: "FORGE", SPIGOT: "SPIGOT", BUNGEECORD: "BUNGEECORD", VELOCITY: "VELOCITY", CUSTOM: "CUSTOM",
  };

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
    ENABLE_RCON: "false",
    ENABLE_AUTOPAUSE: "FALSE",
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
    return NextResponse.json({ error: "Node reinstall failed: " + nodeResult.error }, { status: 503 });
  }

  // 4. Auto-start the server so itzg downloads the JAR immediately
  //    This runs asynchronously — user will see it in the console
  await sendNodeCommand(server.node.id, `/api/agent/servers/${server.id}`, "POST", { action: "start" });

  // 5. Update status in DB
  await db.server.update({
    where: { id },
    data: { status: "STARTING", environment: JSON.stringify(environment) },
  });

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "SERVER_REINSTALLED" as any,
    target: server.name, targetId: server.id,
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({ success: true });
}
