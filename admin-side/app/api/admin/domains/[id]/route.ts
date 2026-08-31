import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { deleteDnsRecord, verifyCloudflareToken, getZoneByDomainName } from "@/lib/dns/cloudflare";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

const updateDomainSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "ERROR", "DISABLED"]).optional(),
  apiToken: z.string().optional(),
  zoneId: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const domain = await db.domain.findUnique({
      where: { id },
      include: {
        subdomains: {
          include: {
            server: {
              select: { id: true, name: true, internalPort: true, node: { select: { id: true, name: true, fqdn: true } } },
            },
            user: {
              select: { id: true, username: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    return NextResponse.json({
      domain: {
        ...domain,
        apiTokenMasked: domain.apiToken.length > 8 ? `${domain.apiToken.substring(0, 4)}...${domain.apiToken.substring(domain.apiToken.length - 4)}` : "••••••••",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch domain" }, { status: 500 });
  }
}

export async function PATCH(
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
    const domain = await db.domain.findUnique({ where: { id } });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateDomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const updateData: any = {};
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.zoneId !== undefined) updateData.zoneId = parsed.data.zoneId.trim();

    if (parsed.data.apiToken && parsed.data.apiToken.trim() !== "") {
      const cleanToken = parsed.data.apiToken.trim();
      const tokenTest = await verifyCloudflareToken(cleanToken);
      if (!tokenTest.valid) {
        return NextResponse.json({ error: `Cloudflare API token verification failed: ${tokenTest.message}` }, { status: 400 });
      }
      updateData.apiToken = cleanToken;
      updateData.isVerified = true;
      updateData.lastVerifiedAt = new Date();
    }

    const updated = await db.domain.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "DOMAIN_UPDATE",
      target: domain.name,
      targetId: domain.id,
      ipAddress: getIpFromRequest(request),
      metadata: { changes: Object.keys(updateData) },
    });

    return NextResponse.json({
      success: true,
      domain: {
        ...updated,
        apiTokenMasked: updated.apiToken.length > 8 ? `${updated.apiToken.substring(0, 4)}...${updated.apiToken.substring(updated.apiToken.length - 4)}` : "••••••••",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update domain" }, { status: 500 });
  }
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
    const domain = await db.domain.findUnique({
      where: { id },
      include: { subdomains: true },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Attempt to safely delete all SRV and target records from Cloudflare first
    if (domain.apiToken && domain.zoneId) {
      for (const sub of domain.subdomains) {
        if (sub.srvRecordId) {
          try {
            await deleteDnsRecord(domain.apiToken, domain.zoneId, sub.srvRecordId);
          } catch (e) {
            console.error(`Failed to delete Cloudflare SRV record ${sub.srvRecordId}:`, e);
          }
        }
      }
    }

    // Delete domain (Cascade deletes all Subdomain DB records)
    await db.domain.delete({ where: { id } });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "DOMAIN_DELETE",
      target: domain.name,
      targetId: domain.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        domainName: domain.name,
        purgedSubdomainsCount: domain.subdomains.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Domain ${domain.name} and ${domain.subdomains.length} associated subdomains were successfully removed.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete domain" }, { status: 500 });
  }
}
