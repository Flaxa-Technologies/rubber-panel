import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  getValidUserGoogleAccessToken,
  deleteFileFromGoogleDrive,
  downloadFileFromGoogleDrive,
} from "@/lib/gdrive";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// POST /api/user/servers/[id]/backups/[backupId] — Restore / Re-roll backup to server
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { id, backupId } = await params;
  const userId = req.headers.get("x-user-id") || new URL(req.url).searchParams.get("userId");

  if (!isInternal(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const wipeBeforeRestore = Boolean(body.wipeBeforeRestore);

    const backup = await db.backup.findUnique({
      where: { id: backupId },
      include: {
        server: { include: { node: true } },
      },
    });

    if (!backup || backup.serverId !== id) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const server = backup.server;
    const targetUserId = userId || server.ownerId;

    let archiveBuffer: Buffer | null = null;

    // If backup is on Google Drive, download it
    if (backup.gdriveFileId) {
      const accessToken = await getValidUserGoogleAccessToken(targetUserId);
      if (!accessToken) {
        return NextResponse.json({
          error: "Google Drive is not linked. Please reconnect Google Drive to restore cloud backups.",
        }, { status: 400 });
      }

      console.log(`[BackupRestore] Downloading backup "${backup.name}" (${backup.gdriveFileId}) from Google Drive...`);
      archiveBuffer = await downloadFileFromGoogleDrive(accessToken, backup.gdriveFileId);
    } else if (backup.nodeBackupPath) {
      const fs = await import("fs/promises");
      const exists = await import("fs").then(f => f.existsSync(backup.nodeBackupPath!));
      if (exists) {
        console.log(`[BackupRestore] Reading local backup "${backup.name}" from ${backup.nodeBackupPath}...`);
        archiveBuffer = await fs.readFile(backup.nodeBackupPath);
      }
    }

    if (!archiveBuffer) {
      return NextResponse.json({ error: "Backup archive data unavailable" }, { status: 400 });
    }

    // Stream the backup archive into Node Agent's import endpoint
    console.log(`[BackupRestore] Extracting snapshot to server "${server.name}" (wipeBeforeRestore=${wipeBeforeRestore})...`);
    const importRes = await fetch(`http://${server.node.fqdn}:${server.node.port}/api/agent/servers/${server.id}/transfer/import?wipe=${wipeBeforeRestore}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Authorization: `Bearer ${server.node.authToken}`,
      },
      body: new Uint8Array(archiveBuffer),
    });

    if (!importRes.ok) {
      const errorText = await importRes.text();
      return NextResponse.json({ error: `Node failed to extract backup: ${errorText}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Server "${server.name}" successfully restored and rolled back from backup "${backup.name}"!`,
    });
  } catch (err: any) {
    console.error("[BackupRestore] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to restore backup" }, { status: 500 });
  }
}

// DELETE /api/user/servers/[id]/backups/[backupId] — Delete backup from Google Drive and DB
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { id, backupId } = await params;
  const userId = req.headers.get("x-user-id") || new URL(req.url).searchParams.get("userId");

  if (!isInternal(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backup = await db.backup.findUnique({
      where: { id: backupId },
      include: { server: true },
    });

    if (!backup || backup.serverId !== id) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const targetUserId = userId || backup.server.ownerId;

    // If on Google Drive, delete file from Google Drive
    if (backup.gdriveFileId) {
      const accessToken = await getValidUserGoogleAccessToken(targetUserId);
      if (accessToken) {
        await deleteFileFromGoogleDrive(accessToken, backup.gdriveFileId);
      }
    }

    // Delete from DB
    await db.backup.delete({ where: { id: backupId } });

    return NextResponse.json({
      success: true,
      message: `Backup "${backup.name}" deleted successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete backup" }, { status: 500 });
  }
}
