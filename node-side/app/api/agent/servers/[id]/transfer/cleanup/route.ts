import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import fsp from "fs/promises";
import fs from "fs";
import path from "path";
import { stopServer, deleteServer } from "@/lib/server-manager";

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
    // 1. Delete server & container
    try {
      await deleteServer(id);
    } catch {}

    // 2. Delete server directory
    if (fs.existsSync(serverDir)) {
      await fsp.rm(serverDir, { recursive: true, force: true });
    }

    console.log(`[NodeTransfer:Cleanup] Successfully cleaned up source files for server ${id}`);
    return NextResponse.json({ success: true, message: "Source files cleaned up successfully" });
  } catch (error: any) {
    console.error("[NodeTransfer:Cleanup] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to cleanup source server" }, { status: 500 });
  }
}
