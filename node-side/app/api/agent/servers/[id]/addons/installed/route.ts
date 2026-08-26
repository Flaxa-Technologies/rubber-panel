import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverDir = getServerDir(id);

    const installed: Array<{
      filename: string;
      type: "plugin" | "mod";
      sizeBytes: number;
      modifiedAt: string;
      path: string;
    }> = [];

    // Scan /plugins
    const pluginsDir = path.join(serverDir, "plugins");
    try {
      const pluginEntries = await fs.readdir(pluginsDir, { withFileTypes: true });
      for (const ent of pluginEntries) {
        if (ent.isFile() && ent.name.endsWith(".jar")) {
          const stats = await fs.stat(path.join(pluginsDir, ent.name));
          installed.push({
            filename: ent.name,
            type: "plugin",
            sizeBytes: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            path: `/plugins/${ent.name}`,
          });
        }
      }
    } catch {
      // plugins folder might not exist yet
    }

    // Scan /mods
    const modsDir = path.join(serverDir, "mods");
    try {
      const modEntries = await fs.readdir(modsDir, { withFileTypes: true });
      for (const ent of modEntries) {
        if (ent.isFile() && ent.name.endsWith(".jar")) {
          const stats = await fs.stat(path.join(modsDir, ent.name));
          installed.push({
            filename: ent.name,
            type: "mod",
            sizeBytes: stats.size,
            modifiedAt: stats.mtime.toISOString(),
            path: `/mods/${ent.name}`,
          });
        }
      }
    } catch {
      // mods folder might not exist yet
    }

    return NextResponse.json({ addons: installed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list installed addons" }, { status: 500 });
  }
}
