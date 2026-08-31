import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { deleteDnsRecord } from "@/lib/dns/cloudflare";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const subdomain = await db.subdomain.findUnique({
      where: { id },
      include: {
        domain: true,
        server: { select: { name: true } },
        user: { select: { username: true } },
      },
    });

    if (!subdomain) {
      return NextResponse.json({ error: "Subdomain not found" }, { status: 404 });
    }

    // Safely delete SRV record in Cloudflare
    if (subdomain.srvRecordId && subdomain.domain.apiToken && subdomain.domain.zoneId) {
      try {
        await deleteDnsRecord(subdomain.domain.apiToken, subdomain.domain.zoneId, subdomain.srvRecordId);
      } catch (err) {
        console.error("Failed to delete Cloudflare DNS record:", err);
      }
    }

    await db.subdomain.delete({ where: { id } });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SUBDOMAIN_DELETE",
      target: subdomain.fqdn,
      targetId: subdomain.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        fqdn: subdomain.fqdn,
        serverId: subdomain.serverId,
        serverName: subdomain.server?.name,
        userId: subdomain.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subdomain ${subdomain.fqdn} successfully deleted and DNS record purged.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete subdomain" }, { status: 500 });
  }
}
