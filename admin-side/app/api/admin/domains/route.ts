import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import {
  verifyCloudflareToken,
  getZoneByDomainName,
  CloudflareZone,
} from "@/lib/dns/cloudflare";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

const createDomainSchema = z.object({
  name: z.string().min(3).max(255),
  provider: z.enum(["CLOUDFLARE", "MANUAL"]).default("CLOUDFLARE"),
  apiToken: z.string().min(1, "Cloudflare API token is required"),
  zoneId: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const domains = await db.domain.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { subdomains: true },
        },
      },
    });

    // Mask API Tokens for safe client consumption
    const sanitized = domains.map((d) => ({
      ...d,
      apiTokenMasked: d.apiToken.length > 8 ? `${d.apiToken.substring(0, 4)}...${d.apiToken.substring(d.apiToken.length - 4)}` : "••••••••",
      subdomainsCount: d._count.subdomains,
    }));

    return NextResponse.json({ domains: sanitized });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch domains" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.SETTINGS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createDomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const rawName = parsed.data.name.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    
    // Check if domain already exists globally
    const existing = await db.domain.findUnique({
      where: { name: rawName },
    });
    if (existing) {
      return NextResponse.json({ error: `Domain "${rawName}" is already registered in the panel.` }, { status: 409 });
    }

    let resolvedZoneId = parsed.data.zoneId?.trim() || "";
    let isVerified = false;
    let status = "PENDING";
    let lastSyncError: string | null = null;

    if (parsed.data.provider === "CLOUDFLARE") {
      // 1. Verify token
      const tokenTest = await verifyCloudflareToken(parsed.data.apiToken);
      if (!tokenTest.valid) {
        return NextResponse.json(
          { error: `Cloudflare API token verification failed: ${tokenTest.message}` },
          { status: 400 }
        );
      }

      // 2. Auto-discover or verify Zone ID
      if (!resolvedZoneId) {
        const zone = await getZoneByDomainName(parsed.data.apiToken, rawName);
        if (!zone) {
          return NextResponse.json(
            { error: `Could not find an active Cloudflare Zone for domain "${rawName}". Ensure the domain is added to your Cloudflare account and active, or specify Zone ID manually.` },
            { status: 400 }
          );
        }
        resolvedZoneId = zone.id;
        isVerified = true;
        status = "ACTIVE";
      } else {
        isVerified = true;
        status = "ACTIVE";
      }
    }

    const domain = await db.domain.create({
      data: {
        name: rawName,
        provider: parsed.data.provider,
        apiToken: parsed.data.apiToken.trim(),
        zoneId: resolvedZoneId,
        description: parsed.data.description?.trim() || null,
        isVerified,
        status,
        lastVerifiedAt: isVerified ? new Date() : null,
        lastSyncError,
      },
    });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "DOMAIN_CREATE",
      target: domain.name,
      targetId: domain.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        domainName: domain.name,
        provider: domain.provider,
        isVerified,
      },
    });

    return NextResponse.json(
      {
        success: true,
        domain: {
          ...domain,
          apiTokenMasked: domain.apiToken.length > 8 ? `${domain.apiToken.substring(0, 4)}...${domain.apiToken.substring(domain.apiToken.length - 4)}` : "••••••••",
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
