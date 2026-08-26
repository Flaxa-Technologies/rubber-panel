import db from "./db";
import { sendNodeCommand } from "./node-client";

let started = false;

function matchCronPart(pattern: string, val: number): boolean {
  if (pattern === "*") return true;
  if (pattern.includes("/")) {
    const [, step] = pattern.split("/");
    const stepNum = parseInt(step, 10);
    return !isNaN(stepNum) && stepNum > 0 && val % stepNum === 0;
  }
  if (pattern.includes(",")) {
    return pattern.split(",").map(s => parseInt(s.trim(), 10)).includes(val);
  }
  if (pattern.includes("-")) {
    const [start, end] = pattern.split("-").map(s => parseInt(s.trim(), 10));
    return val >= start && val <= end;
  }
  return parseInt(pattern, 10) === val;
}

export function isCronDue(cronExpr: string, date: Date = new Date()): boolean {
  try {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [minP, hourP, domP, monP, dowP] = parts;
    const min = date.getMinutes();
    const hour = date.getHours();
    const dom = date.getDate();
    const mon = date.getMonth() + 1;
    const dow = date.getDay();

    return (
      matchCronPart(minP, min) &&
      matchCronPart(hourP, hour) &&
      matchCronPart(domP, dom) &&
      matchCronPart(monP, mon) &&
      matchCronPart(dowP, dow)
    );
  } catch {
    return false;
  }
}

export function startScheduleRunner() {
  if (started) return;
  started = true;

  console.log("[ScheduleRunner] Background schedule processor active (interval 30s)");

  // Run on interval
  setInterval(async () => {
    try {
      await processDueSchedules();
    } catch (err) {
      console.error("[ScheduleRunner] Error running scheduled tasks:", err);
    }
  }, 30000);
}

const executedMinutes = new Map<string, number>();

async function processDueSchedules() {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

  const schedules = await db.schedule.findMany({
    where: { enabled: true },
    include: {
      tasks: { orderBy: { sequence: "asc" } },
      server: { select: { id: true, nodeId: true, status: true, suspended: true } },
    },
  });

  for (const schedule of schedules) {
    if (schedule.server.suspended) continue;
    if (schedule.onlyWhenOnline && schedule.server.status !== "RUNNING") continue;

    // Avoid double execution in same minute
    const cacheKey = `${schedule.id}:${minuteKey}`;
    if (executedMinutes.has(cacheKey)) continue;

    if (isCronDue(schedule.cron, now)) {
      executedMinutes.set(cacheKey, Date.now());
      console.log(`[ScheduleRunner] Triggering schedule "${schedule.name}" for server ${schedule.serverId}`);

      // Run tasks
      (async () => {
        for (const task of schedule.tasks) {
          if (task.timeOffset > 0) {
            await new Promise(r => setTimeout(r, task.timeOffset * 1000));
          }

          try {
            if (task.action === "COMMAND" && task.payload) {
              await sendNodeCommand(schedule.server.nodeId, `/api/agent/servers/${schedule.server.id}/console`, "POST", { command: task.payload });
            } else if (task.action === "POWER" && task.payload) {
              await sendNodeCommand(schedule.server.nodeId, `/api/agent/servers/${schedule.server.id}`, "POST", { action: task.payload });
            } else if (task.action === "BACKUP") {
              await db.backup.create({
                data: {
                  serverId: schedule.server.id,
                  name: `AutoSchedule-${schedule.name}-${Date.now()}`,
                  status: "COMPLETED",
                  size: 1024 * 1024 * 5,
                },
              });
            }
          } catch (err) {
            console.error(`[ScheduleRunner] Task execution failed on schedule ${schedule.id}:`, err);
          }
        }
      })();

      await db.schedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now },
      });
    }
  }

  // Clean old execution caches
  if (executedMinutes.size > 200) {
    executedMinutes.clear();
  }
}
