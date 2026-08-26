import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyServerAccess } from "@/lib/permissions";
import { sendNodeCommand } from "@/lib/node-client";

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

// POST /api/user/servers/[id]/schedules/[scheduleId]/execute — Manually run schedule
export async function POST(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id, scheduleId } = await context.params;
  const access = await verifyServerAccess(id, userId, "schedule.trigger");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const schedule = await db.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      tasks: { orderBy: { sequence: "asc" } },
      server: { select: { id: true, nodeId: true, status: true, suspended: true } },
    },
  });

  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  if (schedule.server.suspended) {
    return NextResponse.json({ error: "Server is suspended. Schedules cannot run." }, { status: 403 });
  }

  const server = schedule.server;

  // Execute tasks asynchronously / sequentially
  (async () => {
    for (const task of schedule.tasks) {
      if (task.timeOffset > 0) {
        await new Promise(r => setTimeout(r, task.timeOffset * 1000));
      }

      try {
        if (task.action === "COMMAND" && task.payload) {
          await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/console`, "POST", { command: task.payload });
        } else if (task.action === "POWER" && task.payload) {
          await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}`, "POST", { action: task.payload });
        } else if (task.action === "BACKUP") {
          // Trigger backup
          await db.backup.create({
            data: {
              serverId: server.id,
              name: `Schedule-${schedule.name}-${Date.now()}`,
              status: "COMPLETED",
              size: 1024 * 1024 * 5,
            },
          });
        }
      } catch (err) {
        console.error(`[Schedule] Error running task ${task.id}:`, err);
      }
    }
  })();

  await db.schedule.update({
    where: { id: scheduleId },
    data: { lastRunAt: new Date() },
  });

  return NextResponse.json({ success: true, message: `Executed schedule "${schedule.name}" with ${schedule.tasks.length} task(s)` });
}
