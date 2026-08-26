import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { filename, type } = body;

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    const safeFilename = path.basename(filename);
    const subDir = type === "mod" ? "mods" : "plugins";
    const filePath = path.join(getServerDir(id), subDir, safeFilename);

    await fs.unlink(filePath);
    console.log(`[AddonInstaller] Uninstalled ${safeFilename} from ${subDir}/`);

    return NextResponse.json({ success: true, removed: safeFilename });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to uninstall addon" }, { status: 500 });
  }
}
