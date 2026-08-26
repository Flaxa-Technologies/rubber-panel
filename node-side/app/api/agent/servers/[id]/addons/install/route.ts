import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { url, filename, type } = body;

    if (!url || !filename) {
      return NextResponse.json({ error: "Missing download url or filename" }, { status: 400 });
    }

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!safeFilename.endsWith(".jar")) {
      return NextResponse.json({ error: "Only .jar addon files can be installed" }, { status: 400 });
    }

    const subDir = type === "mod" ? "mods" : "plugins";
    const targetDir = path.join(getServerDir(id), subDir);

    // Ensure plugins/mods directory exists
    await fs.mkdir(targetDir, { recursive: true });

    const destinationPath = path.join(targetDir, safeFilename);

    console.log(`[AddonInstaller] Node downloading ${safeFilename} from ${url} -> ${subDir}/`);

    // Download from Modrinth directly using Node bandwidth
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RubberPanel/1.0 (contact@rubberpanel.io)",
      },
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: `Modrinth download failed with status ${response.status}` },
        { status: 502 }
      );
    }

    // Stream download to destination file
    const fileStream = createWriteStream(destinationPath);
    // Convert Web ReadableStream to Node.js Readable stream
    // @ts-ignore
    const nodeReadable = Readable.fromWeb(response.body);
    await pipeline(nodeReadable, fileStream);

    const stats = await fs.stat(destinationPath);

    return NextResponse.json({
      success: true,
      filename: safeFilename,
      type: subDir,
      sizeBytes: stats.size,
      installedPath: `/${subDir}/${safeFilename}`,
    });
  } catch (err: any) {
    console.error("[AddonInstaller] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to install addon" }, { status: 500 });
  }
}
