// instrumentation.ts — Runs once on server startup in Next.js
// Used to start the heartbeat loop and reload persisted server states

export async function register() {
  // Only run in the Node.js runtime (not Edge or client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startHeartbeat } = await import("./lib/heartbeat-worker");
    const { reloadStatesFromDisk } = await import("./lib/server-manager");
    const { initCryoSleepEngine } = await import("./lib/cryo-sleep-engine");
    await reloadStatesFromDisk();
    initCryoSleepEngine();
    startHeartbeat();
  }
}
