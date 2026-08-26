import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import db from "@/lib/db";
import { getSetting, setSetting } from "@/lib/settings";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  enabled: z.boolean(),
  title: z.string().min(1).max(100),
  description: z.string().max(300),
  includeAdmin: z.boolean(),
  includeUser: z.boolean(),
  includedNodeIds: z.union([z.literal("ALL"), z.array(z.string())]),
  customMessage: z.string().max(500).optional(),
  noticeType: z.enum(["info", "warning", "maintenance"]).default("info"),
  showNotice: z.boolean().default(false),
  themeAccent: z.enum(["lime", "emerald", "cyan", "amber", "purple"]).default("lime"),
  companyName: z.string().max(100).default("Flaxa Studios"),
  supportUrl: z.string().max(255).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all status page settings
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

  // Fetch all nodes with live heartbeat status
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

  const now = Date.now();
  const nodes = rawNodes.map(n => {
    const lastHb = n.lastHeartbeat ? new Date(n.lastHeartbeat).getTime() : 0;
    const isOnline = lastHb > 0 && now - lastHb <= 60 * 1000;
    return {
      id: n.id,
      name: n.name,
      fqdn: n.fqdn,
      status: isOnline ? "ONLINE" : "OFFLINE",
      isOnline,
      lastHeartbeat: n.lastHeartbeat,
      serversCount: n._count.servers,
    };
  });

  let includedNodeIds: string[] | "ALL" = "ALL";
  if (includedNodeIdsRaw && includedNodeIdsRaw !== "ALL") {
    try {
      includedNodeIds = JSON.parse(includedNodeIdsRaw);
    } catch {
      includedNodeIds = "ALL";
    }
  }

  return NextResponse.json({
    config: {
      enabled: enabled !== "false",
      title: title || "Rubber Panel System Status",
      description: description || "Real-time service health, cluster metrics, and node heartbeat operational state.",
      includeAdmin: includeAdmin !== "false",
      includeUser: includeUser !== "false",
      includedNodeIds,
      customMessage: customMessage || "",
      noticeType: noticeType || "info",
      showNotice: showNotice === "true",
      themeAccent: themeAccent || "lime",
      companyName: companyName || "Flaxa Studios",
      supportUrl: supportUrl || "https://discord.gg/rubberpanel",
    },
    nodes,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const data = updateSchema.parse(json);

    await Promise.all([
      setSetting("status_page.enabled", String(data.enabled), "status_page"),
      setSetting("status_page.title", data.title, "status_page"),
      setSetting("status_page.description", data.description, "status_page"),
      setSetting("status_page.include_admin", String(data.includeAdmin), "status_page"),
      setSetting("status_page.include_user", String(data.includeUser), "status_page"),
      setSetting(
        "status_page.included_node_ids",
        data.includedNodeIds === "ALL" ? "ALL" : JSON.stringify(data.includedNodeIds),
        "status_page"
      ),
      setSetting("status_page.custom_message", data.customMessage || "", "status_page"),
      setSetting("status_page.notice_type", data.noticeType, "status_page"),
      setSetting("status_page.show_notice", String(data.showNotice), "status_page"),
      setSetting("status_page.theme_accent", data.themeAccent, "status_page"),
      setSetting("status_page.company_name", data.companyName, "status_page"),
      setSetting("status_page.support_url", data.supportUrl || "", "status_page"),
    ]);

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SETTINGS_CHANGED",
      target: "Status Page Configuration",
      targetId: "status_page",
      ipAddress: getIpFromRequest(request),
      metadata: { enabled: data.enabled, title: data.title, includeAdmin: data.includeAdmin, includeUser: data.includeUser },
    });

    return NextResponse.json({ success: true, message: "Status page configuration saved successfully." });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Failed to update status page configuration" }, { status: 500 });
  }
}
