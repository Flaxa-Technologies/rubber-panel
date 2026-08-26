import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, unauthorizedResponse } from "@/lib/auth";
import { hibernateServer, wakeServer, registerCryoServer } from "@/lib/cryo-sleep-engine";
import { isWakeProxyRunning, stopWakeProxy } from "@/lib/cryo-sleep-proxy";
import { getServerStatus } from "@/lib/server-manager";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/agent/servers/[id]/cryosleep — Check Cryo-Sleep status
export async function GET(request: NextRequest, context: RouteContext) {
  if (!verifyAgentToken(request)) return unauthorizedResponse();

  const { id } = await context.params;
  const status = await getServerStatus(id);
  const isSleeping = isWakeProxyRunning(id);

  return NextResponse.json({
    serverId: id,
    isSleeping,
    status: isSleeping ? "SLEEPING" : status?.status || "OFFLINE",
  });
}

// POST /api/agent/servers/[id]/cryosleep — Action: "wake" | "hibernate" | "config"
export async function POST(request: NextRequest, context: RouteContext) {
  if (!verifyAgentToken(request)) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "wake";

  if (action === "wake") {
    const result = await wakeServer(id, body.trigger || "Manual Panel Trigger");
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (action === "hibernate") {
    const result = await hibernateServer(id, body.reason || "Manual Panel Trigger");
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (action === "config") {
    const isEnabled = body.enabled === true;
    registerCryoServer({
      serverId: id,
      serverName: body.name || "Server",
      port: body.port || 25565,
      serverType: body.serverType || "MINECRAFT",
      enabled: isEnabled,
      idleMinutes: Number(body.idleMinutes) || 10,
      motd: body.motd,
      wakeMessage: body.wakeMessage,
    });

    if (isEnabled) {
      // If server is not currently running, immediately arm the wake proxy
      const status = await getServerStatus(id);
      if (!status || status.status !== "RUNNING") {
        await hibernateServer(id, "Cryo-Sleep activated");
      }
    } else {
      await stopWakeProxy(id);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
