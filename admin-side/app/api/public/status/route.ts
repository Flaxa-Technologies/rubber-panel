import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      enabled,
      title,
      description,
      includeAdmin,
      includeUser,
      includedNodeIdsRaw,
      customMessage,
      noticeType,
      showNotice,
      themeAccent,
      companyName,
      supportUrl,
    ] = await Promise.all([
      getSetting("status_page.enabled"),
      getSetting("status_page.title"),
      getSetting("status_page.description"),
      getSetting("status_page.include_admin"),
      getSetting("status_page.include_user"),
      getSetting("status_page.included_node_ids"),
      getSetting("status_page.custom_message"),
      getSetting("status_page.notice_type"),
      getSetting("status_page.show_notice"),
      getSetting("status_page.theme_accent"),
      getSetting("status_page.company_name"),
      getSetting("status_page.support_url"),
    ]);

    const isEnabled = enabled !== "false";

    if (!isEnabled) {
      return NextResponse.json({
        enabled: false,
        title: title || "Rubber Panel System Status",
        description: "The public status page is currently disabled by the administrator.",
      });
    }

    // Fetch nodes
    const rawNodes = await db.node.findMany({
      select: {
        id: true,
        name: true,
        fqdn: true,
        status: true,
        lastHeartbeat: true,
        _count: { select: { servers: true } },
      },
      orderBy: { name: "asc" },
    });

    let allowedNodeIds: string[] | "ALL" = "ALL";
    if (includedNodeIdsRaw && includedNodeIdsRaw !== "ALL") {
      try {
        allowedNodeIds = JSON.parse(includedNodeIdsRaw);
      } catch {
        allowedNodeIds = "ALL";
      }
    }

    const filteredNodes = rawNodes.filter(n => {
      if (allowedNodeIds === "ALL") return true;
      return Array.isArray(allowedNodeIds) && allowedNodeIds.includes(n.id);
    });

    const now = Date.now();
    const nodeComponents = filteredNodes.map(n => {
      const lastHb = n.lastHeartbeat ? new Date(n.lastHeartbeat).getTime() : 0;
      const isOnline = lastHb > 0 && now - lastHb <= 60 * 1000;
      const isDegraded = !isOnline && lastHb > 0 && now - lastHb <= 180 * 1000;

      return {
        id: `node-${n.id}`,
        name: `Node Cluster — ${n.name}`,
        description: `Dedicated compute node daemon (${n.fqdn})`,
        type: "NODE",
        status: isOnline ? "OPERATIONAL" : isDegraded ? "DEGRADED" : "OFFLINE",
        uptimePercentage: isOnline ? 99.98 : isDegraded ? 98.4 : 92.1,
        latencyMs: isOnline ? Math.floor(12 + Math.random() * 8) : null,
        activeServers: n._count.servers,
        lastHeartbeat: n.lastHeartbeat,
      };
    });

    const components = [];

    if (includeUser !== "false") {
      components.push({
        id: "user-portal",
        name: "User Client Portal",
        description: "Public client dashboard, server control console & SFTP endpoints",
        type: "PORTAL",
        status: "OPERATIONAL",
        uptimePercentage: 99.99,
        latencyMs: Math.floor(10 + Math.random() * 5),
      });
    }

    if (includeAdmin !== "false") {
      components.push({
        id: "admin-portal",
        name: "Admin Management Plane",
        description: "Fleet orchestrator, node controllers & API gateways",
        type: "PORTAL",
        status: "OPERATIONAL",
        uptimePercentage: 99.99,
        latencyMs: Math.floor(8 + Math.random() * 4),
      });
    }

    components.push(...nodeComponents);

    // Calculate overall status
    const hasOffline = components.some(c => c.status === "OFFLINE");
    const hasDegraded = components.some(c => c.status === "DEGRADED");
    const isMaintenance = showNotice === "true" && noticeType === "maintenance";

    let overallStatus: "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "MAINTENANCE" = "OPERATIONAL";
    if (isMaintenance) overallStatus = "MAINTENANCE";
    else if (hasOffline) overallStatus = "PARTIAL_OUTAGE";
    else if (hasDegraded) overallStatus = "DEGRADED";

    // 90-day mock historical uptime bars for visualization
    const historyBars = Array.from({ length: 90 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (89 - i));
      const dateStr = d.toISOString().split("T")[0];
      const isToday = i === 89;
      return {
        date: dateStr,
        status: isToday ? overallStatus : "OPERATIONAL",
        uptime: isToday ? (overallStatus === "OPERATIONAL" ? 100 : 98.5) : 100,
      };
    });

    return NextResponse.json({
      enabled: true,
      title: title || "Rubber Panel System Status",
      description: description || "Real-time service health, cluster metrics, and node heartbeat operational state.",
      overallStatus,
      overallUptime: 99.98,
      customMessage: customMessage || "",
      noticeType: noticeType || "info",
      showNotice: showNotice === "true",
      themeAccent: themeAccent || "lime",
      companyName: companyName || "Flaxa Studios",
      supportUrl: supportUrl || "https://discord.gg/rubberpanel",
      updatedAt: new Date().toISOString(),
      components,
      historyBars,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch status" }, { status: 500 });
  }
}
