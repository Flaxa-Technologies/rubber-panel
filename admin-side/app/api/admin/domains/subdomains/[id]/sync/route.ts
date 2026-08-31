import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { testSrvDnsResolution, updateMinecraftSrvRecord, createMinecraftSrvRecord } from "@/lib/dns/cloudflare";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const subdomain = await db.subdomain.findUnique({
      where: { id },
      include: {
        domain: true,
        server: {
          include: {
            node: true,
            allocations: { take: 1 },
          },
        },
      },
    });

    if (!subdomain) {
      return NextResponse.json({ error: "Subdomain not found" }, { status: 404 });
    }

    // Live DNS resolution test
    const dnsTest = await testSrvDnsResolution(subdomain.fqdn);
    
    // Check if Cloudflare SRV record needs recreation or update
    let srvRecordId = subdomain.srvRecordId;
    let syncError: string | null = null;
    let status = dnsTest.resolved ? "ACTIVE" : "PENDING";

    if (subdomain.domain.apiToken && subdomain.domain.zoneId) {
      if (srvRecordId) {
        const updateRes = await updateMinecraftSrvRecord(
          subdomain.domain.apiToken,
          subdomain.domain.zoneId,
          srvRecordId,
          subdomain.domain.name,
          subdomain.subdomain,
          subdomain.targetHost,
          subdomain.port
        );
        if (!updateRes.success) {
          syncError = updateRes.error || "Failed to update SRV record";
          status = "ERROR";
        }
      } else {
        const createRes = await createMinecraftSrvRecord(
          subdomain.domain.apiToken,
          subdomain.domain.zoneId,
          subdomain.domain.name,
          subdomain.subdomain,
          subdomain.targetHost,
          subdomain.port
        );
        if (createRes.success && createRes.recordId) {
          srvRecordId = createRes.recordId;
          status = "ACTIVE";
        } else {
          syncError = createRes.error || "Failed to recreate SRV record";
          status = "ERROR";
        }
      }
    }

    const updated = await db.subdomain.update({
      where: { id },
      data: {
        srvRecordId,
        status,
        lastError: syncError,
        lastSyncAt: new Date(),
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SUBDOMAIN_FORCE_SYNC",
      target: subdomain.fqdn,
      targetId: subdomain.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        resolved: dnsTest.resolved,
        target: dnsTest.target,
        port: dnsTest.port,
        status,
      },
    });

    return NextResponse.json({
      success: true,
      dnsTest,
      subdomain: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Sync failed" }, { status: 500 });
  }
}
