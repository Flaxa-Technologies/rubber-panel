// instrumentation.ts — Runs once on server startup in Next.js
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduleRunner } = await import("./lib/schedule-runner");
    startScheduleRunner();
  }
}
