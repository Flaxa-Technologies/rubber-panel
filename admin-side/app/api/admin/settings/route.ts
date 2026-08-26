import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { getAllSettings, setSetting } from "@/lib/settings";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}
const settingsSchema = z.record(z.string(), z.string());

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = settingsSchema.safeParse(body.settings);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings format" }, { status: 400 });

  const groupMap: Record<string, string> = {
    "auth.": "auth",
    "security.": "security",
    "server.": "server",
    "node.": "node",
    "branding.": "branding",
    "social.": "social",
    "features.": "features",
    "cryosleep.": "cryosleep",
  };

  for (const [key, value] of Object.entries(parsed.data)) {
    let group = "general";
    for (const [prefix, g] of Object.entries(groupMap)) {
      if (key.startsWith(prefix)) { group = g; break; }
    }
    await setSetting(key, value, group);
  }

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "SETTINGS_CHANGED",
    ipAddress: getIpFromRequest(request),
    metadata: { keys: Object.keys(parsed.data) },
  });

  return NextResponse.json({ success: true });
}
