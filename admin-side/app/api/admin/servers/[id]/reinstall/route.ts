import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/servers/[id]/reinstall — Reinstall with file preservation and engine accuracy
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const preservePaths: string[] = Array.isArray(body.preservePaths) ? body.preservePaths : [];

  const server = await db.server.findUnique({
    where: { id },
    include: {
      node: { select: { id: true } },
      software: { select: { type: true, name: true } },
      softwareVersion: { select: { version: true } },
      allocations: { take: 1, orderBy: { port: "asc" } },
    },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

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
    return NextResponse.json({ error: "Node reinstall failed: " + (nodeResult.error || "Unknown error") }, { status: 503 });
  }

  await db.server.update({
    where: { id },
    data: { status: "OFFLINE", environment: JSON.stringify(env) },
  });

  await createAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "SERVER_REINSTALLED" as any,
    target: server.name,
    targetId: server.id,
    ipAddress: getIpFromRequest(request),
  });

  return NextResponse.json({ success: true, preserved: preservePaths });
}
