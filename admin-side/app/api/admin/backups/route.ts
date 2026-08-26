import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// GET /api/admin/backups — Aggregated global backups inventory and stats
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!isInternal(req) && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get("serverId");
  const status = searchParams.get("status");
  const storageType = searchParams.get("storageType");

  const where: any = {};
  if (serverId) where.serverId = serverId;
  if (status && status !== "all") where.status = status;
  if (storageType && storageType !== "all") where.storageType = storageType;

  try {
    const backups = await db.backup.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            uuid: true,
            owner: { select: { id: true, username: true, email: true } },
            node: { select: { id: true, name: true } },
          },
        },
      },
    });

    const totalBackups = backups.length;
    const completedBackups = backups.filter((b) => b.status === "COMPLETED").length;
    const gdriveBackups = backups.filter((b) => b.storageType === "GOOGLE_DRIVE" || b.storageType === "BOTH").length;
    const localBackups = backups.filter((b) => b.storageType === "LOCAL" || b.storageType === "BOTH").length;
    const totalSizeBytes = backups.reduce((acc, b) => acc + (b.size || 0), 0);

    return NextResponse.json({
      backups,
      stats: {
        totalBackups,
        completedBackups,
        gdriveBackups,
        localBackups,
        totalSizeBytes,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load backups" }, { status: 500 });
  }
}
