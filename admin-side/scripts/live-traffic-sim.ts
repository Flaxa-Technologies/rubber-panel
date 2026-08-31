import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function startTrafficSimulation() {
  console.log("[Radar Sim] Live traffic pulse generator running...");
  const node = await db.node.findFirst();
  const nodeId = node?.id || "8ad9e5c6-9794-474a-aef3-446005d0f7d2";

  setInterval(async () => {
    try {
      const now = new Date();
      // Generate realistic fluctuation between 15 and 85 conns/s with occasional spikes
      const base = 25 + Math.floor(Math.sin(Date.now() / 15000) * 15);
      const spike = Math.random() < 0.15 ? Math.floor(Math.random() * 40) : 0;
      const connsPerSec = base + spike;
      const bytesPerSecIn = connsPerSec * 1024 * (12 + Math.floor(Math.random() * 8));
      const bytesPerSecOut = bytesPerSecIn * 2;

      await db.radarSample.create({
        data: {
          nodeId,
          timestamp: now,
          connsPerSec,
          bytesPerSecIn,
          bytesPerSecOut,
          activeBans: 3,
        },
      });

      // Update node live RX/TX
      await db.node.updateMany({
        where: { id: nodeId },
        data: {
          networkRx: bytesPerSecIn,
          networkTx: bytesPerSecOut,
        },
      });
    } catch (err: any) {
      console.warn("[Radar Sim] Note:", err.message);
    }
  }, 3000);
}

startTrafficSimulation();
