import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function verifyInternalSecret(request: NextRequest): string | null {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  if (!expectedSecret || internalSecret !== expectedSecret || !userId) return null;
  return userId;
}

// GET /api/user/servers/[id]/console — Fetch buffered console logs
export async function GET(request: NextRequest, context: RouteContext) {
  const userId = verifyInternalSecret(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const since = request.nextUrl.searchParams.get("since") ?? "0";

  const access = await verifyServerAccess(id, userId, "control.console");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "This instance is suspended. Console access is locked." }, { status: 403 });
  }

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/console?since=${since}`, "GET");
  if (!result.success) {
    return NextResponse.json({ lines: [], total: 0 });
  }
  return NextResponse.json(result.data ?? { lines: [], total: 0 });
}

// POST /api/user/servers/[id]/console — Send a console command
export async function POST(request: NextRequest, context: RouteContext) {
  const userId = verifyInternalSecret(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const access = await verifyServerAccess(id, userId, "control.command");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true, status: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "This instance is suspended. Command execution is locked." }, { status: 403 });
  }

  const body = await request.json();
  const command = body.command as string;
  if (!command?.trim()) return NextResponse.json({ error: "No command provided" }, { status: 400 });

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/console`, "POST", { command });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
