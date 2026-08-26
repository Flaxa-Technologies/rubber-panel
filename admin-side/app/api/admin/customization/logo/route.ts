import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { setSetting } from "@/lib/settings";
import path from "path";
import fs from "fs/promises";

type AdminUser = { id: string; email: string; role: string };

async function getActor(): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function POST(request: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const targetType = (formData.get("type") as string) || "logo"; // "logo" or "favicon"

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "image/webp",
      "image/x-icon",
      "image/vnd.microsoft.icon",
      "image/gif",
    ];

    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: "Invalid image format. Supported: PNG, JPG, SVG, WEBP, ICO, GIF" }, { status: 400 });
    }

    // Limit to 10MB
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image size exceeds 10MB limit" }, { status: 400 });
    }

    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "png";
    const filename = `${targetType}-${Date.now()}.${ext}`;

    // Target upload paths
    const adminUploadsDir = path.resolve(process.cwd(), "public", "uploads");
    const userUploadsDir = path.resolve(process.cwd(), "..", "user-side", "public", "uploads");

    await fs.mkdir(adminUploadsDir, { recursive: true });
    await fs.mkdir(userUploadsDir, { recursive: true }).catch(() => {});

    // Save to admin public/uploads
    await fs.writeFile(path.join(adminUploadsDir, filename), buffer);

    // Save to user-side public/uploads
    try {
      await fs.writeFile(path.join(userUploadsDir, filename), buffer);
    } catch {}

    const relativeUrl = `/uploads/${filename}`;
    const settingKey = targetType === "favicon" ? "branding.faviconUrl" : "branding.logoUrl";

    await setSetting(settingKey, relativeUrl, "branding");

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "BRANDING_LOGO_UPDATED",
      ipAddress: getIpFromRequest(request),
      metadata: { filename, url: relativeUrl, type: targetType },
    });

    return NextResponse.json({
      success: true,
      url: relativeUrl,
      key: settingKey,
      filename,
      message: "Branding asset uploaded and applied successfully!",
    });
  } catch (err: any) {
    console.error("[Customization Logo Upload Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to upload asset" }, { status: 500 });
  }
}
