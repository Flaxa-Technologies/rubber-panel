import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, unauthorizedResponse } from "@/lib/auth";
import fs from "fs";
import path from "path";

const PUMPKIN_STORAGE_DIR = path.join(process.cwd(), ".data", "software", "pumpkin");

// GET /api/agent/software/pumpkin/binary?commit=<sha> — Serve raw binary for peer node replication
export async function GET(request: NextRequest) {
  if (!verifyAgentToken(request)) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const commit = (searchParams.get("commit") || "").trim();

  if (!commit) {
    return NextResponse.json({ error: "Missing commit query parameter" }, { status: 400 });
  }

  const binaryPath = path.join(PUMPKIN_STORAGE_DIR, commit, "pumpkin");
  if (!fs.existsSync(binaryPath)) {
    return NextResponse.json({ error: "Pumpkin binary not found on this node" }, { status: 404 });
  }

  const stat = fs.statSync(binaryPath);
  const stream = fs.createReadStream(binaryPath);

  // Return binary stream with headers
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": stat.size.toString(),
      "Content-Disposition": `attachment; filename="pumpkin-${commit}"`,
    },
  });
}
