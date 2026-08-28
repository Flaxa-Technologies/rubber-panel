import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import { syncPumpkinReleases, syncPumpkinBuildToNodes } from "@/lib/pumpkin-service";

// POST /api/admin/software/pumpkin/sync — Discover new releases from GitHub and/or push to nodes
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { versionId, pushToNodes } = body;

    // 1. Sync releases from GitHub
    const syncResult = await syncPumpkinReleases();

    // 2. Optionally distribute specific build or latest build to all nodes
    let nodeResults = null;
    const targetVersionId = versionId || syncResult.builds.find(b => b.isLatest)?.versionId;
    if (pushToNodes && targetVersionId) {
      nodeResults = await syncPumpkinBuildToNodes(targetVersionId);
    }

    return NextResponse.json({
      success: true,
      syncResult,
      nodeResults,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Pumpkin sync failed" }, { status: 500 });
  }
}
