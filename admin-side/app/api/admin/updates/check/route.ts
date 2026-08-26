import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import { checkForUpdates } from "@/lib/updater";
import db from "@/lib/db";

/** POST /api/admin/updates/check
 *  Force re-polls GitHub (busts cache) and returns fresh update info
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const info = await checkForUpdates();

    const nodes = await db.node.findMany({
      select: {
        id: true,
        name: true,
        fqdn: true,
        port: true,
        status: true,
        agentVersion: true,
        lastHeartbeat: true,
      },
      orderBy: { name: "asc" },
    });

    const isNewer = (await import("@/lib/updater")).isNewerVersion;

    const nodesWithUpdate = nodes.map((n) => {
      const currentVer = n.agentVersion || "0.1.0";
      const needsUpdate = info.available && isNewer(currentVer, info.latestVersion);
      return {
        ...n,
        currentVersion: currentVer,
        needsUpdate,
      };
    });

    const fullResponse = {
      success: true,
      ...info,
      nodes: nodesWithUpdate,
    };

    const cacheVal = JSON.stringify(fullResponse);
    await db.setting.upsert({
      where: { key: "updates.cache" },
      create: { key: "updates.cache", value: cacheVal, group: "updates" },
      update: { value: cacheVal },
    });
    await db.setting.upsert({
      where: { key: "updates.cacheAt" },
      create: { key: "updates.cacheAt", value: new Date().toISOString(), group: "updates" },
      update: { value: new Date().toISOString() },
    });

    return NextResponse.json(fullResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to check updates" }, { status: 500 });
  }
}
