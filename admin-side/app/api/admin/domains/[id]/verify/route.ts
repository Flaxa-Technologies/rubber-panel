import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { verifyCloudflareToken, getZoneByDomainName } from "@/lib/dns/cloudflare";

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
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const domain = await db.domain.findUnique({ where: { id } });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    if (domain.provider === "CLOUDFLARE") {
      // 1. Verify token
      const tokenTest = await verifyCloudflareToken(domain.apiToken);
      if (!tokenTest.valid) {
        await db.domain.update({
          where: { id },
          data: {
            isVerified: false,
            status: "ERROR",
            lastSyncError: tokenTest.message || "Cloudflare API token verification failed",
          },
        });
        return NextResponse.json({
          success: false,
          error: tokenTest.message || "Cloudflare token invalid",
        }, { status: 400 });
      }

      // 2. Verify Zone exists & is active
      let zoneId = domain.zoneId;
      if (!zoneId) {
        const zone = await getZoneByDomainName(domain.apiToken, domain.name);
        if (!zone) {
          await db.domain.update({
            where: { id },
            data: {
              isVerified: false,
              status: "ERROR",
              lastSyncError: `No active Cloudflare Zone found for ${domain.name}`,
            },
          });
          return NextResponse.json({
            success: false,
            error: `No active Cloudflare Zone found for ${domain.name}`,
          }, { status: 400 });
        }
        zoneId = zone.id;
      }

      // Successful verification
      const updated = await db.domain.update({
        where: { id },
        data: {
          zoneId,
          isVerified: true,
          status: "ACTIVE",
          lastVerifiedAt: new Date(),
          lastSyncError: null,
        },
      });

      await createAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "DOMAIN_VERIFIED",
        target: domain.name,
        targetId: domain.id,
        ipAddress: getIpFromRequest(request),
        metadata: { zoneId },
      });

      return NextResponse.json({
        success: true,
        message: `Domain ${domain.name} successfully verified with Cloudflare.`,
        domain: updated,
      });
    }

    return NextResponse.json({ success: true, message: "Domain verified" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Verification failed" }, { status: 500 });
  }
}
