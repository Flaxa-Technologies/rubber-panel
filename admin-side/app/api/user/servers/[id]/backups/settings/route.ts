import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

function isInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  return Boolean(secret && expected && secret === expected);
}

// PATCH /api/user/servers/[id]/backups/settings — Update server backup policies
export async function PATCH(
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
    const { gdriveRetentionCount, gdriveAutoSchedule, gdriveExcludePaths } = body;

    const data: any = {};
    if (typeof gdriveRetentionCount === "number" && gdriveRetentionCount >= 1 && gdriveRetentionCount <= 50) {
      data.gdriveRetentionCount = gdriveRetentionCount;
    }
    if (typeof gdriveAutoSchedule === "string") {
      data.gdriveAutoSchedule = gdriveAutoSchedule;
    }
    if (Array.isArray(gdriveExcludePaths)) {
      data.gdriveExcludePaths = JSON.stringify(gdriveExcludePaths);
    }

    const updated = await db.server.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      message: "Backup policy settings updated successfully!",
      policies: {
        gdriveRetentionCount: updated.gdriveRetentionCount,
        gdriveAutoSchedule: updated.gdriveAutoSchedule,
        gdriveExcludePaths: updated.gdriveExcludePaths ? JSON.parse(updated.gdriveExcludePaths) : [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update backup settings" }, { status: 500 });
  }
}
