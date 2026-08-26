import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// POST /api/user/servers/[id]/backups/gdrive/disconnect — Disconnect user Google Drive
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-user-id") || new URL(req.url).searchParams.get("userId");

  if (!isInternal(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const server = await db.server.findUnique({ where: { id } });
    if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

    const targetUserId = userId || server.ownerId;
    await db.userGoogleDriveToken.deleteMany({ where: { userId: targetUserId } });

    return NextResponse.json({
      success: true,
      message: "Google Drive account disconnected successfully.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to disconnect Google Drive" }, { status: 500 });
  }
}
