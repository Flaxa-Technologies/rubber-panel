import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

// PATCH /api/user/servers/[id]/schedules/[scheduleId] — Update schedule & tasks
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id, scheduleId } = await context.params;
  const access = await verifyServerAccess(id, userId, "schedule.edit");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.cron !== undefined) data.cron = body.cron.trim();
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.onlyWhenOnline !== undefined) data.onlyWhenOnline = Boolean(body.onlyWhenOnline);

  // If tasks are supplied, replace existing tasks
  if (Array.isArray(body.tasks)) {
    await db.scheduleTask.deleteMany({ where: { scheduleId } });
    await db.scheduleTask.createMany({
      data: body.tasks.map((t: any, idx: number) => ({
        scheduleId,
        sequence: t.sequence ?? idx + 1,
        action: t.action || "COMMAND",
        payload: t.payload || "",
        timeOffset: parseInt(t.timeOffset) || 0,
      })),
    });
  }

  const updated = await db.schedule.update({
    where: { id: scheduleId },
    data,
    include: {
      tasks: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  return NextResponse.json({ success: true, schedule: updated });
}

// DELETE /api/user/servers/[id]/schedules/[scheduleId] — Delete schedule
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id, scheduleId } = await context.params;
  const access = await verifyServerAccess(id, userId, "schedule.delete");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  await db.schedule.delete({
    where: { id: scheduleId },
  });

  return NextResponse.json({ success: true, message: "Schedule deleted" });
}
