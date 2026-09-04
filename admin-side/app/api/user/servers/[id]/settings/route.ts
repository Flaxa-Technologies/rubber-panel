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

  if (body.startupCommand !== undefined) {
    if (server.allowEditStartup === false && body.startupCommand !== server.startupCommand) {
      return NextResponse.json({ error: "Editing startup command is restricted by administration for this instance." }, { status: 403 });
    }
    dataUpdate.startupCommand = body.startupCommand || null;
  }

  if (body.softwareId !== undefined || body.softwareType !== undefined) {
    if (server.allowChangeSoftware === false) {
      return NextResponse.json({ error: "Changing server software is restricted by administration for this instance." }, { status: 403 });
    }

    const targetIdentifier = String(body.softwareId || body.softwareType || "").trim();
    let sw = await db.software.findUnique({ where: { id: targetIdentifier } }).catch(() => null);

    if (!sw) {
      sw = await db.software.findFirst({
        where: {
          OR: [
            { type: targetIdentifier.toUpperCase() },
            { name: targetIdentifier },
            ...(body.softwareType ? [{ type: body.softwareType.toUpperCase() }] : []),
            ...(body.softwareName ? [{ name: body.softwareName }] : []),
          ],
        },
      });
    }

    if (!sw && (body.softwareType || body.softwareName)) {
      const swType = (body.softwareType || targetIdentifier).toUpperCase();
      const swName = body.softwareName || targetIdentifier;
      sw = await db.software.create({
        data: {
          name: swName,
          type: swType,
          description: `${swName} server runtime environment.`,
        },
      }).catch(() => null);
    }

    if (sw) {
      dataUpdate.softwareId = sw.id;
      if (sw.type === "PUMPKIN") {
        dataUpdate.serverType = "PUMPKIN";
      } else if (sw.type === "NODEJS") {
        dataUpdate.serverType = "NODEJS";
      } else if (sw.type === "DATABASE") {
        dataUpdate.serverType = "DATABASE";
      } else {
        dataUpdate.serverType = "MINECRAFT";
      }
      try {
        const currentEnv = JSON.parse(server.environment || "{}");
        currentEnv.TYPE = sw.type;
        currentEnv.SERVER_TYPE = dataUpdate.serverType;
        dataUpdate.environment = JSON.stringify(currentEnv);
      } catch {}
    }
  }

  if (body.softwareVersionId !== undefined || body.version !== undefined) {
    if (server.allowChangeVersion === false) {
      return NextResponse.json({ error: "Changing server version is restricted by administration for this instance." }, { status: 403 });
    }

    const currentSoftwareId = dataUpdate.softwareId || server.softwareId;
    let ver = null;

    if (body.softwareVersionId) {
      ver = await db.softwareVersion.findUnique({ where: { id: body.softwareVersionId } }).catch(() => null);
    }

    const versionStr = body.version ? String(body.version).trim() : null;

    if (!ver && versionStr && currentSoftwareId) {
      ver = await db.softwareVersion.findFirst({
        where: {
          softwareId: currentSoftwareId,
          version: versionStr,
        },
      });

      if (!ver) {
        ver = await db.softwareVersion.create({
          data: {
            softwareId: currentSoftwareId,
            version: versionStr,
            isStable: true,
          },
        }).catch(() => null);
      }
    }

    if (ver) {
      dataUpdate.softwareVersionId = ver.id;
    }

    const finalVerString = ver?.version || versionStr;
    if (finalVerString) {
      try {
        const currentEnv = JSON.parse(dataUpdate.environment || server.environment || "{}");
        currentEnv.VERSION = finalVerString;
        dataUpdate.environment = JSON.stringify(currentEnv);
      } catch {}
    }
  }

  if (body.nodeVersion !== undefined) {
    dataUpdate.nodeVersion = String(body.nodeVersion).trim();
  }

  if (body.securityProtection !== undefined) {
    dataUpdate.securityProtection = Boolean(body.securityProtection);
  }

  if (body.javaVersion !== undefined) {
    const cleanJava = String(body.javaVersion).trim();
    dataUpdate.javaVersion = cleanJava;

    // Find matching JavaVersion in DB to ensure javaVersionId matches cleanJava
    const matchedJv = await db.javaVersion.findFirst({
      where: {
        version: cleanJava,
        OR: [{ nodeId: null }, { nodeId: server.nodeId }],
      },
    });
    dataUpdate.javaVersionId = matchedJv?.id || body.javaVersionId || null;

    try {
      const currentEnv = JSON.parse(server.environment || "{}");
      currentEnv.JAVA_VERSION = cleanJava;
      if (server.serverType === "MINECRAFT" || !currentEnv.SERVER_TYPE || currentEnv.SERVER_TYPE === "MINECRAFT") {
        currentEnv.DOCKER_IMAGE = `eclipse-temurin:${cleanJava}-jre-alpine`;
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
    select: {
      id: true, name: true, startupCommand: true, javaVersion: true, javaVersionId: true,
      cryoSleepMotd: true, internalPort: true, environment: true,
      software: { select: { name: true, type: true } },
      softwareVersion: { select: { version: true } },
    },
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
