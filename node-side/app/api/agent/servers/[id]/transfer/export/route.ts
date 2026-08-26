import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

function getServerDir(serverId: string): string {
  return path.join(process.cwd(), ".data", "servers", serverId);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const serverDir = getServerDir(id);

  try {
    const exists = fs.existsSync(serverDir);
    if (!exists) {
      return NextResponse.json({ error: "Server directory not found on source node" }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const excludePaths: string[] = Array.isArray(body.excludePaths) ? body.excludePaths : [];

    const zip = new AdmZip();
    let totalBytes = 0;
    let fileCount = 0;

    async function addEntries(dir: string, zipPath = "") {
      const entries = await fsp.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryRel = zipPath ? `${zipPath}/${entry.name}` : entry.name;

        // Check exclusions
        const isExcluded = excludePaths.some((ex) => {
          const normEx = ex.replace(/^\/+/, "").replace(/\/+$/, "");
          return entryRel === normEx || entryRel.startsWith(normEx + "/");
        });

        if (isExcluded) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          zip.addFile(entryRel + "/", Buffer.alloc(0));
          await addEntries(fullPath, entryRel);
        } else if (entry.isFile()) {
          const content = await fsp.readFile(fullPath);
          zip.addFile(entryRel, content);
          totalBytes += content.length;
          fileCount++;
        }
      }
    }

    await addEntries(serverDir);

    console.log(`[NodeTransfer:Export] Packaged server ${id}: ${fileCount} files, ${totalBytes} bytes`);

    const zipBuffer = zip.toBuffer();

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="server-${id}-transfer.zip"`,
        "X-Transfer-Total-Files": fileCount.toString(),
        "X-Transfer-Total-Bytes": totalBytes.toString(),
      },
    });
  } catch (error: any) {
    console.error("[NodeTransfer:Export] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to export server archive" }, { status: 500 });
  }
}
