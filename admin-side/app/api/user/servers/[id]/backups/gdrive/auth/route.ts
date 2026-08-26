import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthAuthUrl } from "@/lib/gdrive";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// GET /api/user/servers/[id]/backups/gdrive/auth — Generate OAuth URL
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-user-id") || new URL(req.url).searchParams.get("userId");
  const redirectUri = new URL(req.url).searchParams.get("redirectUri") || "http://localhost:3002/api/auth/gdrive/callback";

  if (!isInternal(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = Buffer.from(JSON.stringify({ userId, serverId: id })).toString("base64url");
  const url = await getGoogleOAuthAuthUrl(redirectUri, state);

  if (!url) {
    return NextResponse.json({
      error: "Google Drive integration is not configured by panel administrator yet.",
    }, { status: 400 });
  }

  return NextResponse.json({ url });
}
