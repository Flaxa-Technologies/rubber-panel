import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  let serverId = "";
  let userId = "";

  try {
    if (stateRaw) {
      const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
      serverId = decoded.serverId;
      userId = decoded.userId;
    }
  } catch {}

  const fallbackRedirect = serverId ? `/servers/${serverId}/backups` : "/dashboard";

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`${fallbackRedirect}?gdrive=error&message=${encodeURIComponent(error || "Authorization was cancelled.")}`, APP_URL)
    );
  }

  const redirectUri = `${APP_URL}/api/auth/gdrive/callback`;

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/user/servers/${serverId || "global"}/backups/gdrive/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        code,
        redirectUri,
        targetUserId: userId,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?gdrive=success`, APP_URL));
    } else {
      return NextResponse.redirect(
        new URL(`${fallbackRedirect}?gdrive=error&message=${encodeURIComponent(data.error || "Failed to link Google Drive")}`, APP_URL)
      );
    }
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`${fallbackRedirect}?gdrive=error&message=${encodeURIComponent(err.message || "Failed to complete Google link")}`, APP_URL)
    );
  }
}
