import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { exchangeGoogleAuthCode, getGoogleDriveAccountDetails } from "@/lib/gdrive";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// POST /api/user/servers/[id]/backups/gdrive/callback — Exchange OAuth code & save tokens
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
    const body = await req.json();
    const { code, redirectUri, targetUserId } = body;

    const actualUserId = targetUserId || userId;
    if (!code || !redirectUri || !actualUserId) {
      return NextResponse.json({ error: "Missing required OAuth parameters." }, { status: 400 });
    }

    const tokenData = await exchangeGoogleAuthCode(code, redirectUri);
    const expiryDate = new Date(Date.now() + tokenData.expiresIn * 1000);

    // Fetch Google user profile for display
    const accountDetails = await getGoogleDriveAccountDetails(tokenData.accessToken);

    await db.userGoogleDriveToken.upsert({
      where: { userId: actualUserId },
      create: {
        userId: actualUserId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiry: expiryDate,
        accountEmail: accountDetails.email,
        accountName: accountDetails.name,
      },
      update: {
        accessToken: tokenData.accessToken,
        ...(tokenData.refreshToken ? { refreshToken: tokenData.refreshToken } : {}),
        tokenExpiry: expiryDate,
        accountEmail: accountDetails.email,
        accountName: accountDetails.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Google Drive account (${accountDetails.email || "Connected"}) successfully linked!`,
      account: accountDetails,
    });
  } catch (err: any) {
    console.error("[GoogleDriveCallback] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to link Google Drive" }, { status: 500 });
  }
}
