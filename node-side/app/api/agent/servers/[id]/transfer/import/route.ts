import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, verifyAgentTokenAsync } from "@/lib/auth";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { getServerDir, registerImportedServer } from "@/lib/server-manager";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAgentTokenAsync(request))) {
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

    // Check for server metadata from header (for binary stream uploads)
    let serverMeta: any = null;
    const metaHeader = request.headers.get("x-server-meta");
    if (metaHeader) {
      try {
        serverMeta = JSON.parse(Buffer.from(metaHeader, "base64").toString("utf-8"));
      } catch {}
    }

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // JSON body with metadata and/or direct pull URL
      const body = await request.json();
      const { sourceUrl, sourceToken, excludePaths } = body;
      if (body.serverMeta) {
        serverMeta = body.serverMeta;
      }

      if (!sourceUrl) {
        // If no sourceUrl, check if archive was supplied or just registering state
        if (serverMeta) {
          await registerImportedServer(id, serverMeta);
        }
        return NextResponse.json({
          success: true,
          message: "Server instance metadata registered",
          targetDir,
        });
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

      // Register server state cleanly into memory & disk
      if (serverMeta) {
        await registerImportedServer(id, serverMeta);
      }

      console.log(`[NodeTransfer:Import] Successfully unpacked server ${id} onto target node`);
      return NextResponse.json({
        success: true,
        message: "Server instance successfully imported and unpacked",
        targetDir,
      });
    } else {
      // Direct binary stream upload (streamed via Admin panel or direct push)
      const arrayBuffer = await request.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        return NextResponse.json({ error: "Empty archive payload" }, { status: 400 });
      }

      const zip = new AdmZip(Buffer.from(arrayBuffer));
      zip.extractAllTo(targetDir, true);

      // Register server state cleanly into memory & disk
      if (serverMeta) {
        await registerImportedServer(id, serverMeta);
      }

      console.log(`[NodeTransfer:Import] Direct binary unpack complete for server ${id}`);
      return NextResponse.json({
        success: true,
        message: "Server instance archive unpacked and registered successfully",
        targetDir,
      });
    }
  } catch (error: any) {
    console.error("[NodeTransfer:Import] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to import server archive" }, { status: 500 });
  }
}
