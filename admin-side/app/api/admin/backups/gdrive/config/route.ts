import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import { getGoogleDriveConfig, saveGoogleDriveConfig } from "@/lib/gdrive";
import { createAuditLog } from "@/lib/audit";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// GET /api/admin/backups/gdrive/config — Secure configuration inspector (never leaks secret)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!isInternal(req) && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getGoogleDriveConfig();
  return NextResponse.json({
    configured: config.configured,
    clientId: config.clientId ? `${config.clientId.slice(0, 16)}...` : undefined,
    fullClientId: config.clientId || undefined,
    clientSecretSet: Boolean(config.clientSecret),
  });
}

// POST /api/admin/backups/gdrive/config — Save or overwrite Google OAuth credentials
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!isInternal(req) && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { clientId, clientSecret } = body;

    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json({ error: "Valid Google Client ID is required." }, { status: 400 });
    }

    const success = await saveGoogleDriveConfig(clientId, clientSecret);
    if (!success) {
      return NextResponse.json({ error: "Failed to persist Google Drive credentials." }, { status: 500 });
    }

    await createAuditLog({
      actorId: actor?.id || "system",
      actorEmail: actor?.email || "internal",
      action: "SETTINGS_UPDATED" as any,
      target: "Google Drive OAuth Credentials",
      metadata: { action: "GDRIVE_OAUTH_CONFIGURED" },
    });

    return NextResponse.json({
      success: true,
      message: "Google Drive OAuth credentials securely saved and enabled!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to configure Google Drive" }, { status: 500 });
  }
}
