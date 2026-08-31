import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { deleteDnsRecord } from "@/lib/dns/cloudflare";

type UserSession = { id: string; email: string; role: string };

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as UserSession;

  const { id } = await params;
  try {
    const subdomain = await db.subdomain.findUnique({
      where: { id },
      include: {
        domain: true,
        server: { select: { name: true } },
      },
    });

    if (!subdomain) {
      return NextResponse.json({ error: "Subdomain not found" }, { status: 404 });
    }

    if (subdomain.userId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "You do not have permission to delete this subdomain." }, { status: 403 });
    }

    // Safely delete SRV record from Cloudflare
    if (subdomain.srvRecordId && subdomain.domain.apiToken && subdomain.domain.zoneId) {
      try {
        await deleteDnsRecord(subdomain.domain.apiToken, subdomain.domain.zoneId, subdomain.srvRecordId);
      } catch (err) {
        console.error("Cloudflare delete DNS record failed:", err);
      }
    }

    await db.subdomain.delete({ where: { id } });

    await createAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "SUBDOMAIN_DELETE",
      target: subdomain.fqdn,
      targetId: subdomain.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        fqdn: subdomain.fqdn,
        serverId: subdomain.serverId,
        serverName: subdomain.server?.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subdomain ${subdomain.fqdn} was successfully released.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete subdomain" }, { status: 500 });
  }
}
