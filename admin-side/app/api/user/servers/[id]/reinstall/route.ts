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

// POST /api/user/servers/[id]/reinstall — Reinstall with file preservation and engine accuracy
export async function POST(request: NextRequest, context: RouteContext) {
  const userId = verifyInternalSecret(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const preservePaths: string[] = Array.isArray(body.preservePaths) ? body.preservePaths : [];

  const server = await db.server.findFirst({
    where: { id, ownerId: userId },
    include: {
      node: { select: { id: true } },
      software: { select: { type: true, name: true } },
      softwareVersion: { select: { version: true } },
      allocations: { take: 1, orderBy: { port: "asc" } },
    },
  });
  if (!server) return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });

  const isPumpkin = server.software?.type === "PUMPKIN" || server.serverType === "PUMPKIN" || server.software?.name?.toLowerCase().includes("pumpkin");
  const softwareType = isPumpkin ? "PUMPKIN" : (server.software?.type || "PAPER");
  const softwareVersion = server.softwareVersion?.version || (isPumpkin ? "nightly" : "1.21.1");

  let env: Record<string, string> = {};
  try {
    env = JSON.parse(server.environment || "{}");
  } catch {}
  env.TYPE = softwareType;
  env.VERSION = softwareVersion;
  env.SERVER_TYPE = isPumpkin ? "PUMPKIN" : (server.serverType || "MINECRAFT");

  const nodeResult = await sendNodeCommand(server.node.id, `/api/agent/servers/${id}/reinstall`, "POST", {
    preservePaths,
    softwareType,
    softwareVersion,
    serverType: env.SERVER_TYPE,
    environment: env,
  });

  if (!nodeResult.success) {
    return NextResponse.json({ error: "Reinstall failed on node: " + (nodeResult.error || "Unknown error") }, { status: 503 });
  }

  await db.server.update({
    where: { id },
    data: { status: "OFFLINE", environment: JSON.stringify(env) },
  });

  return NextResponse.json({ success: true, preserved: preservePaths });
}
