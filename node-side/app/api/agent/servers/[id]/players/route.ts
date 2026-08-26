import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getConsoleLogs } from "@/lib/server-manager";

function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverDir = getServerDir(id);

    const [bannedPlayers, whitelist, ops] = await Promise.all([
      readJsonSafe<any[]>(path.join(serverDir, "banned-players.json"), []),
      readJsonSafe<any[]>(path.join(serverDir, "whitelist.json"), []),
      readJsonSafe<any[]>(path.join(serverDir, "ops.json"), []),
    ]);

    // Parse active players from recent console logs
    const logs = getConsoleLogs(id);
    const onlineSet = new Set<string>();

    for (const log of logs) {
      // Regex for "Player joined the game"
      const joinMatch = log.match(/(\w+) joined the game/i);
      if (joinMatch && joinMatch[1]) {
        onlineSet.add(joinMatch[1]);
      }
      // Regex for "Player left the game" or "Player lost connection"
      const leaveMatch = log.match(/(\w+) (left the game|lost connection)/i);
      if (leaveMatch && leaveMatch[1]) {
        onlineSet.delete(leaveMatch[1]);
      }
    }

    const onlinePlayers = Array.from(onlineSet).map(name => {
      const isOp = ops.some((o: any) => (o.name || "").toLowerCase() === name.toLowerCase());
      return {
        name,
        isOp,
        online: true,
      };
    });

    return NextResponse.json({
      online: onlinePlayers,
      banned: bannedPlayers.map((b: any) => ({
        name: b.name || "Unknown",
        reason: b.reason || "Banned by administrator",
        created: b.created || new Date().toISOString(),
        source: b.source || "Server",
      })),
      whitelist: whitelist.map((w: any) => ({
        name: w.name || "Unknown",
        uuid: w.uuid || "",
      })),
      ops: ops.map((o: any) => ({
        name: o.name || "Unknown",
        level: o.level || 4,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch players" }, { status: 500 });
  }
}
