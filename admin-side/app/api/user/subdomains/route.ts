import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { getSetting, getSettingBool, getSettingInt } from "@/lib/settings";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import {
  ensureNodeTargetRecord,
  createMinecraftSrvRecord,
  deleteDnsRecord,
} from "@/lib/dns/cloudflare";
import { z } from "zod";

type UserSession = { id: string; email: string; role: string; username?: string };

const createSubdomainSchema = z.object({
  domainId: z.string().min(1, "Root domain is required"),
  serverId: z.string().min(1, "Server is required"),
  subdomain: z.string().min(3, "Subdomain must be at least 3 characters").max(32, "Subdomain must not exceed 32 characters"),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as UserSession;

  try {
    const globalDefault = await getSettingInt("domains.defaultPerServer");
    const allowSubdomains = await getSettingBool("domains.allowSubdomains");

    // Fetch user's Minecraft servers with allocations
    const servers = await db.server.findMany({
      where: {
        ownerId: user.id,
        serverType: "MINECRAFT",
        isSandbox: false,
      },
      select: {
        id: true,
        name: true,
        customDomainLimit: true,
        allocations: {
          select: { ip: true, port: true },
        },
        _count: {
          select: { subdomains: true },
        },
      },
    });

    const subdomains = await db.subdomain.findMany({
      where: { userId: user.id },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            provider: true,
            status: true,
          },
        },
        server: {
          select: {
            id: true,
            name: true,
            node: {
              select: { id: true, name: true, fqdn: true },
            },
            allocations: {
              take: 1,
              select: { ip: true, port: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Server limits computation
    const serverLimits = servers.map((s) => {
      let limit = globalDefault;
      if (s.customDomainLimit !== null && s.customDomainLimit !== -1) {
        limit = s.customDomainLimit;
      }
      return {
        serverId: s.id,
        serverName: s.name,
        limit,
        used: s._count.subdomains,
        canCreate: allowSubdomains && limit > 0 && s._count.subdomains < limit,
      };
    });

    return NextResponse.json({
      subdomains,
      serverLimits,
      allowSubdomains,
      globalDefault,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch subdomains" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as UserSession;

  try {
    const isGloballyAllowed = await getSettingBool("domains.allowSubdomains");
    if (!isGloballyAllowed) {
      return NextResponse.json({ error: "Custom subdomains are currently disabled by system administrators." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSubdomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const rawPrefix = parsed.data.subdomain.trim().toLowerCase();

    // 1. Format validation (alphanumeric + hyphen, 3-32 chars, cannot start/end with hyphen)
    const validFormat = /^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$/.test(rawPrefix);
    if (!validFormat) {
      return NextResponse.json(
        { error: "Subdomain prefix must only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen (3-32 characters)." },
        { status: 400 }
      );
    }

    // 2. Reserved prefix validation
    const reservedRaw = await getSetting("domains.reservedPrefixes");
    let reservedList: string[] = ["admin", "panel", "node", "api", "mail", "smtp", "ftp", "ssh", "ns1", "ns2", "www", "dev", "status"];
    try {
      if (reservedRaw) reservedList = JSON.parse(reservedRaw);
    } catch {}

    if (reservedList.includes(rawPrefix)) {
      return NextResponse.json(
        { error: `The subdomain prefix "${rawPrefix}" is reserved for system services. Please choose a different prefix.` },
        { status: 400 }
      );
    }

    // 3. Verify root domain exists and is active & verified
    const domain = await db.domain.findUnique({
      where: { id: parsed.data.domainId },
    });
    if (!domain || domain.status !== "ACTIVE" || !domain.isVerified) {
      return NextResponse.json({ error: "Selected domain is not available or active." }, { status: 400 });
    }

    const fullFqdn = `${rawPrefix}.${domain.name}`.toLowerCase();

    // 4. Global Duplicate Check
    const existingFqdn = await db.subdomain.findUnique({
      where: { fqdn: fullFqdn },
    });
    if (existingFqdn) {
      return NextResponse.json({ error: `The custom domain "${fullFqdn}" is already in use. Please select a different prefix.` }, { status: 409 });
    }

    // 5. Verify server ownership and compatibility
    const server = await db.server.findUnique({
      where: { id: parsed.data.serverId },
      include: {
        node: true,
        allocations: {
          orderBy: { createdAt: "asc" },
        },
        subdomains: true,
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found." }, { status: 404 });
    }

    if (server.ownerId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "You do not own this server." }, { status: 403 });
    }

    if (server.isSandbox || server.serverType !== "MINECRAFT") {
      return NextResponse.json({ error: "Custom Minecraft SRV subdomains can only be attached to Minecraft servers." }, { status: 400 });
    }

    if (!server.allocations || server.allocations.length === 0) {
      return NextResponse.json({ error: "This server does not have an allocated port." }, { status: 400 });
    }

    // 6. Check Server Domain Limits
    const globalDefault = await getSettingInt("domains.defaultPerServer");
    let allowedLimit = globalDefault;
    if (server.customDomainLimit !== null && server.customDomainLimit !== -1) {
      allowedLimit = server.customDomainLimit;
    }

    if (allowedLimit <= 0) {
      return NextResponse.json({ error: "Custom domains are not permitted on this server." }, { status: 403 });
    }

    if (server.subdomains.length >= allowedLimit) {
      return NextResponse.json(
        { error: `This server has reached its limit of ${allowedLimit} custom domain(s). Delete an existing subdomain or contact an administrator to increase your allocation.` },
        { status: 400 }
      );
    }

    // 7. Resolve Target Host and Port
    const primaryAlloc = server.allocations[0];
    const serverPort = primaryAlloc.port;
    
    // Resolve Node IP
    let nodeIp = primaryAlloc.ip;
    if (!nodeIp || nodeIp === "0.0.0.0" || nodeIp === "127.0.0.1" || nodeIp === "localhost") {
      nodeIp = server.node.fqdn;
    }

    // Construct Node Target Host (e.g. "srv-node1.example.com" or "node-<nodeIdShort>.example.com")
    const nodeSlug = `node-${server.node.id.substring(0, 8)}`;
    const targetHost = `${nodeSlug}.${domain.name}`.toLowerCase();

    let targetRecordId: string | null = null;
    let srvRecordId: string | null = null;
    let srvStatus = "ACTIVE";
    let lastError: string | null = null;

    if (domain.provider === "CLOUDFLARE" && domain.apiToken && domain.zoneId) {
      // Step A: Ensure target A record for the node exists on Cloudflare
      const targetRes = await ensureNodeTargetRecord(
        domain.apiToken,
        domain.zoneId,
        domain.name,
        targetHost,
        nodeIp
      );

      if (!targetRes.success) {
        return NextResponse.json(
          { error: `Failed to configure DNS target host in Cloudflare: ${targetRes.error}` },
          { status: 500 }
        );
      }
      targetRecordId = targetRes.recordId || null;

      // Step B: Create individual Minecraft SRV record
      const srvRes = await createMinecraftSrvRecord(
        domain.apiToken,
        domain.zoneId,
        domain.name,
        rawPrefix,
        targetHost,
        serverPort
      );

      if (!srvRes.success || !srvRes.recordId) {
        return NextResponse.json(
          { error: `Cloudflare rejected Minecraft SRV record creation: ${srvRes.error}` },
          { status: 500 }
        );
      }
      srvRecordId = srvRes.recordId;
    }

    // 8. Persist in Database
    const newSubdomain = await db.subdomain.create({
      data: {
        domainId: domain.id,
        serverId: server.id,
        userId: user.id,
        subdomain: rawPrefix,
        fqdn: fullFqdn,
        srvRecordId,
        targetRecordId,
        targetHost,
        port: serverPort,
        status: srvStatus,
        lastError,
        lastSyncAt: new Date(),
      },
      include: {
        domain: {
          select: { id: true, name: true, provider: true },
        },
        server: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: "SUBDOMAIN_CREATE",
      target: fullFqdn,
      targetId: newSubdomain.id,
      ipAddress: getIpFromRequest(request),
      metadata: {
        fqdn: fullFqdn,
        serverId: server.id,
        serverName: server.name,
        port: serverPort,
        targetHost,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Subdomain ${fullFqdn} successfully registered and configured!`,
        subdomain: newSubdomain,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Failed to create subdomain:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
