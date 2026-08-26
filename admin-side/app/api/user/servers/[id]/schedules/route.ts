import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

// GET /api/user/servers/[id]/schedules — List schedules & tasks
export async function GET(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const access = await verifyServerAccess(id, userId, "schedule.view");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const schedules = await db.schedule.findMany({
    where: { serverId: id },
    include: {
      tasks: {
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ schedules });
}

// POST /api/user/servers/[id]/schedules — Create schedule with optional tasks
export async function POST(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const access = await verifyServerAccess(id, userId, "schedule.create");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const name = (body.name || "Automated Schedule").trim();
  const cron = (body.cron || "0 0 * * *").trim();
  const enabled = body.enabled !== undefined ? Boolean(body.enabled) : true;
  const onlyWhenOnline = body.onlyWhenOnline !== undefined ? Boolean(body.onlyWhenOnline) : true;
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];

  const schedule = await db.schedule.create({
    data: {
      serverId: id,
      name,
      cron,
      enabled,
      onlyWhenOnline,
      tasks: {
        create: tasks.map((t: any, index: number) => ({
          sequence: t.sequence ?? index + 1,
          action: t.action || "COMMAND",
          payload: t.payload || "",
          timeOffset: parseInt(t.timeOffset) || 0,
        })),
      },
    },
    include: {
      tasks: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  return NextResponse.json({ success: true, schedule });
}
