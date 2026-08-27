import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import { checkForUpdates } from "@/lib/updater";
import db from "@/lib/db";

/** GET /api/admin/updates
 *  Returns current + latest version info.
 *  Caches result in Setting table for 15 minutes unless ?force=true
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const force = request.nextUrl.searchParams.get("force") === "true";

  // Check cache (15 min)
  if (!force) {
    const cached = await db.setting.findUnique({ where: { key: "updates.cache" } });
    if (cached) {
      const cachedAt = await db.setting.findUnique({ where: { key: "updates.cacheAt" } });
      if (cachedAt) {
        const age = Date.now() - new Date(cachedAt.value).getTime();
        if (age < 15 * 60 * 1000) {
          return NextResponse.json(JSON.parse(cached.value));
        }
      }
    }
  }

  try {
    const info = await checkForUpdates();

    // Fetch registered nodes to report per-node status
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
      const needsUpdate = isNewer(currentVer, info.latestVersion);
      return {
        ...n,
        currentVersion: currentVer,
        needsUpdate,
      };
    });

    const fullResponse = {
      ...info,
      nodes: nodesWithUpdate,
    };

    // Store in cache
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
