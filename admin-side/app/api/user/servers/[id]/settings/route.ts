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

// PATCH /api/user/servers/[id]/settings — Update server name / startup command (ownership verified)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = verifyInternalSecret(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json();

  const server = await db.server.findFirst({ where: { id, ownerId: userId } });
  if (!server) return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });

  const dataUpdate: Record<string, any> = {};
  if (body.name?.trim()) dataUpdate.name = body.name.trim();
  if (body.startupCommand !== undefined) dataUpdate.startupCommand = body.startupCommand || null;

  if (body.javaVersion !== undefined) {
    const cleanJava = String(body.javaVersion).trim();
    dataUpdate.javaVersion = cleanJava;
    if (body.javaVersionId) {
      dataUpdate.javaVersionId = body.javaVersionId;
    }
    try {
      const currentEnv = JSON.parse(server.environment || "{}");
      currentEnv.JAVA_VERSION = cleanJava;
      if (server.serverType === "MINECRAFT" || !currentEnv.SERVER_TYPE || currentEnv.SERVER_TYPE === "MINECRAFT") {
        currentEnv.DOCKER_IMAGE = `itzg/minecraft-server:java${cleanJava}`;
      }
      dataUpdate.environment = JSON.stringify(currentEnv);
    } catch {}
  }

  if (body.cryoSleepMotd !== undefined) {
    if (server.cryoSleepCustomMotdAllowed) {
      dataUpdate.cryoSleepMotd = body.cryoSleepMotd ? String(body.cryoSleepMotd).trim() : null;
    } else {
      return NextResponse.json({ error: "Custom MOTD modification is restricted by administration for this instance." }, { status: 403 });
    }
  }

  if (body.internalPort !== undefined) {
    const portNum = body.internalPort ? parseInt(String(body.internalPort), 10) : null;
    dataUpdate.internalPort = portNum && portNum > 0 ? portNum : null;
    try {
      const currentEnv = JSON.parse(server.environment || "{}");
      if (portNum && portNum > 0) {
        currentEnv.INTERNAL_PORT = String(portNum);
      } else {
        delete currentEnv.INTERNAL_PORT;
      }
      dataUpdate.environment = JSON.stringify(currentEnv);
    } catch {}
  }

  if (body.environment !== undefined) {
    try {
      const parsed = typeof body.environment === "string" ? JSON.parse(body.environment) : body.environment;
      dataUpdate.environment = JSON.stringify(parsed);
      if (parsed.INTERNAL_PORT) {
        dataUpdate.internalPort = parseInt(String(parsed.INTERNAL_PORT), 10) || null;
      }
    } catch {}
  }

  const updated = await db.server.update({
    where: { id },
    data: dataUpdate,
    select: { id: true, name: true, startupCommand: true, javaVersion: true, javaVersionId: true, cryoSleepMotd: true, internalPort: true, environment: true },
  });

  if (server.nodeId) {
    let envToSend: any = undefined;
    if (dataUpdate.environment) {
      try { envToSend = JSON.parse(dataUpdate.environment); } catch {}
    }
    sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "PATCH", {
      name: dataUpdate.name ?? server.name,
      startupCommand: dataUpdate.startupCommand ?? server.startupCommand,
      environment: envToSend,
    }).catch(() => {});
  }

  if (body.cryoSleepMotd !== undefined && server.nodeId) {
    sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/cryosleep`, "POST", {
      action: "config",
      motd: dataUpdate.cryoSleepMotd,
      enabled: server.cryoSleepEnabled,
      idleMinutes: server.cryoSleepIdleMinutes,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
