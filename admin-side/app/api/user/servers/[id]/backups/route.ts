import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  getGoogleDriveConfig,
  getValidUserGoogleAccessToken,
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  getGoogleDriveAccountDetails,
} from "@/lib/gdrive";
import { sendNodeCommand } from "@/lib/node-client";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// GET /api/user/servers/[id]/backups — List server backups and cloud status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-user-id") || new URL(req.url).searchParams.get("userId");

  if (!isInternal(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const server = await db.server.findUnique({
      where: { id },
      include: {
        backups: { orderBy: { createdAt: "desc" } },
        owner: { select: { id: true, email: true } },
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const targetUserId = userId || server.ownerId;

    // Check Google Drive Panel configuration & user link status
    const gdriveConfig = await getGoogleDriveConfig();
    const gdriveToken = await db.userGoogleDriveToken.findUnique({
      where: { userId: targetUserId },
    });

    let gdriveAccount: any = null;
    if (gdriveToken) {
      const accessToken = await getValidUserGoogleAccessToken(targetUserId);
      if (accessToken) {
        const details = await getGoogleDriveAccountDetails(accessToken);
        gdriveAccount = {
          linked: true,
          email: details.email || gdriveToken.accountEmail,
          name: details.name || gdriveToken.accountName,
          storageTotal: details.storageTotal,
          storageUsed: details.storageUsed,
        };
      }
    }

    let excludePathsArr: string[] = [".cache", "logs", "crash-reports"];
    try {
      if (server.gdriveExcludePaths) {
        excludePathsArr = JSON.parse(server.gdriveExcludePaths);
      }
    } catch {}

    return NextResponse.json({
      backups: server.backups,
      policies: {
        allowGoogleDriveBackups: server.allowGoogleDriveBackups,
        gdriveRetentionCount: server.gdriveRetentionCount || 3,
        gdriveAutoSchedule: server.gdriveAutoSchedule || "DISABLED",
        gdriveExcludePaths: excludePathsArr,
      },
      gdriveStatus: {
        panelConfigured: gdriveConfig.configured,
        userLinked: Boolean(gdriveAccount?.linked),
        account: gdriveAccount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load backups" }, { status: 500 });
  }
}

// POST /api/user/servers/[id]/backups — Create manual or automatic backup with retention rotation
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
    const server = await db.server.findUnique({
      where: { id },
      include: {
        node: true,
        backups: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const targetUserId = userId || server.ownerId;
    const storageType = body.storageType || "GOOGLE_DRIVE"; // GOOGLE_DRIVE | LOCAL | BOTH
    const name = body.name?.trim() || `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    const excludePaths = Array.isArray(body.excludePaths) ? body.excludePaths : [".cache", "logs", "crash-reports"];

    let gdriveFileId: string | null = null;
    let gdriveWebUrl: string | null = null;
    let backupSize = 0;

    // 1. Export archive from Node Agent
    const nodeRes = await fetch(`http://${server.node.fqdn}:${server.node.port}/api/agent/servers/${server.id}/transfer/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${server.node.authToken}`,
      },
      body: JSON.stringify({ excludePaths }),
    });

    if (!nodeRes.ok) {
      const errorText = await nodeRes.text();
      return NextResponse.json({ error: `Node failed to package backup: ${errorText}` }, { status: 500 });
    }

    const archiveArrayBuffer = await nodeRes.arrayBuffer();
    const archiveBuffer = Buffer.from(archiveArrayBuffer);
    backupSize = archiveBuffer.length;

    // 2. If storageType includes GOOGLE_DRIVE: Process retention rotation & upload to Google Drive
    if (storageType === "GOOGLE_DRIVE" || storageType === "BOTH") {
      if (!server.allowGoogleDriveBackups) {
        return NextResponse.json({ error: "Google Drive backups are disabled for this server by administrator." }, { status: 403 });
      }

      const accessToken = await getValidUserGoogleAccessToken(targetUserId);
      if (!accessToken) {
        return NextResponse.json({
          error: "Google Drive is not connected. Please link your Google Drive account first.",
        }, { status: 400 });
      }

      // --- RETENTION ROTATION ENGINE ---
      const maxRetention = server.gdriveRetentionCount || 3;
      const existingGdriveBackups = await db.backup.findMany({
        where: {
          serverId: server.id,
          storageType: { in: ["GOOGLE_DRIVE", "BOTH"] },
          gdriveFileId: { not: null },
        },
        orderBy: { createdAt: "asc" },
      });

      // If we already reached or exceeded the retention ceiling, delete the oldest backup(s)
      if (existingGdriveBackups.length >= maxRetention) {
        const excessCount = existingGdriveBackups.length - maxRetention + 1;
        const toDelete = existingGdriveBackups.slice(0, excessCount);

        for (const oldBackup of toDelete) {
          if (oldBackup.gdriveFileId) {
            console.log(`[BackupRetention] Purging oldest Google Drive backup (${oldBackup.name}) to enforce max ${maxRetention}...`);
            await deleteFileFromGoogleDrive(accessToken, oldBackup.gdriveFileId);
            await db.backup.delete({ where: { id: oldBackup.id } });
          }
        }
      }

      // Upload the new snapshot to user's Google Drive
      const uploadResult = await uploadFileToGoogleDrive(
        accessToken,
        name,
        archiveBuffer,
        "application/zip",
        `RubberPanel-${server.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`
      );

      gdriveFileId = uploadResult.fileId;
      gdriveWebUrl = uploadResult.webViewLink;
    }

    // If storageType includes LOCAL, save archive to disk
    let nodeBackupPath: string | null = null;
    if (storageType === "LOCAL" || storageType === "BOTH") {
      const fs = await import("fs/promises");
      const path = await import("path");
      const backupDir = path.join(process.cwd(), ".data", "backups", server.id);
      await fs.mkdir(backupDir, { recursive: true });
      const filePath = path.join(backupDir, name);
      await fs.writeFile(filePath, archiveBuffer);
      nodeBackupPath = filePath;
    }

    // 3. Create Backup DB record
    const createdBackup = await db.backup.create({
      data: {
        serverId: server.id,
        name,
        status: "COMPLETED",
        storageType,
        size: backupSize,
        gdriveFileId,
        gdriveWebUrl,
        nodeBackupPath,
        excludePaths: JSON.stringify(excludePaths),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      backup: createdBackup,
      message: `Backup "${name}" successfully created and saved to ${storageType === "GOOGLE_DRIVE" ? "Google Drive" : storageType}!`,
    });
  } catch (err: any) {
    console.error("[CreateBackup] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create backup" }, { status: 500 });
  }
}
