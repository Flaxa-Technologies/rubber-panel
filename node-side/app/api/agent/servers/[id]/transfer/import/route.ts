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
  const targetDir = getServerDir(id);

  try {
    const { searchParams } = new URL(request.url);
    const wipe = searchParams.get("wipe") === "true";
    if (wipe && fs.existsSync(targetDir)) {
      console.log(`[NodeTransfer:Import] Wiping existing directory for server ${id} before restore/re-roll...`);
      const files = await fsp.readdir(targetDir);
      for (const file of files) {
        await fsp.rm(path.join(targetDir, file), { recursive: true, force: true });
      }
    }

    await fsp.mkdir(targetDir, { recursive: true });

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Direct Node-to-Node Pull via URL
      const body = await request.json();
      const { sourceUrl, sourceToken, excludePaths, serverMeta } = body;

      if (!sourceUrl) {
        return NextResponse.json({ error: "Missing sourceUrl for node transfer import" }, { status: 400 });
      }

      console.log(`[NodeTransfer:Import] Pulling server ${id} stream from source node: ${sourceUrl}`);

      const response = await fetch(sourceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: sourceToken ? `Bearer ${sourceToken}` : "",
          "X-Rubber-Panel": "admin",
        },
        body: JSON.stringify({ excludePaths: excludePaths || [] }),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Source node export failed with HTTP ${response.status}` },
          { status: 502 }
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const zip = new AdmZip(Buffer.from(arrayBuffer));
      zip.extractAllTo(targetDir, true);

      // Write / update server state
      if (serverMeta) {
        const stateFile = path.join(targetDir, ".rp-state.json");
        await fsp.writeFile(stateFile, JSON.stringify(serverMeta, null, 2), "utf-8");
      }

      console.log(`[NodeTransfer:Import] Successfully unpacked server ${id} onto target node`);
      return NextResponse.json({
        success: true,
        message: "Server instance successfully imported and unpacked",
        targetDir,
      });
    } else {
      // Direct binary stream upload
      const arrayBuffer = await request.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return NextResponse.json({ error: "Empty archive payload" }, { status: 400 });
      }

      const zip = new AdmZip(Buffer.from(arrayBuffer));
      zip.extractAllTo(targetDir, true);

      return NextResponse.json({
        success: true,
        message: "Server instance archive unpacked successfully",
        targetDir,
      });
    }
  } catch (error: any) {
    console.error("[NodeTransfer:Import] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to import server archive" }, { status: 500 });
  }
}
