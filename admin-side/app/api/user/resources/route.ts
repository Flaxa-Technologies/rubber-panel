import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  let userId: string | null = null;

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (internalSecret && internalSecret === expectedSecret) {
    const { searchParams } = new URL(req.url);
    userId = searchParams.get("userId");
  } else {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user, quota] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        include: {
          servers: {
            select: {
              id: true,
              name: true,
              ram: true,
              cpu: true,
              disk: true,
              baseRam: true,
              baseCpu: true,
              baseDisk: true,
              extraRam: true,
              extraCpu: true,
              extraDisk: true,
              isCreatedFromQuota: true,
              status: true,
              suspended: true,
              suspensionReason: true,
              expiresAt: true,
              allocations: { select: { id: true, port: true } },
              backups: { select: { id: true } },
            },
          },
        },
      }),
      db.userResourceQuota.findUnique({
        where: { userId },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const servers = user.servers || [];

    if (!quota) {
      // User has no extra quota pool assigned
      return NextResponse.json({
        hasCustomQuota: false,
        quota: null,
        servers,
      });
    }

    // Calculate usage against the extra quota pool
    let usedRamFromQuota = 0;
    let usedCpuFromQuota = 0;
    let usedDiskFromQuota = 0;
    let quotaServersCount = 0;
    let quotaAllocationsCount = 0;
    let quotaBackupsCount = 0;

    for (const s of servers) {
      if (s.isCreatedFromQuota) {
        usedRamFromQuota += s.ram;
        usedCpuFromQuota += s.cpu;
        usedDiskFromQuota += s.disk;
        quotaServersCount += 1;
        quotaAllocationsCount += (s.allocations?.length || 1);
        quotaBackupsCount += (s.backups?.length || 0);
      } else {
        usedRamFromQuota += (s.extraRam || 0);
        usedCpuFromQuota += (s.extraCpu || 0);
        usedDiskFromQuota += (s.extraDisk || 0);
        quotaAllocationsCount += Math.max(0, (s.allocations?.length || 1) - 1);
      }
    }

    const remainingRam = Math.max(0, quota.maxRam - usedRamFromQuota);
    const remainingCpu = Math.max(0, quota.maxCpu - usedCpuFromQuota);
    const remainingDisk = Math.max(0, quota.maxDisk - usedDiskFromQuota);
    const remainingServers = Math.max(0, quota.maxServers - quotaServersCount);
    const remainingAllocations = Math.max(0, quota.maxAllocations - quotaAllocationsCount);
    const remainingBackups = Math.max(0, quota.maxBackups - quotaBackupsCount);

    const now = new Date();
    const isExpired = quota.expiresAt ? new Date(quota.expiresAt) < now : false;

    return NextResponse.json({
      hasCustomQuota: true,
      quota: {
        ...quota,
        usedRam: usedRamFromQuota,
        usedCpu: usedCpuFromQuota,
        usedDisk: usedDiskFromQuota,
        usedAllocations: quotaAllocationsCount,
        usedBackups: quotaBackupsCount,
        serverCount: quotaServersCount,
        remainingRam,
        remainingCpu,
        remainingDisk,
        remainingAllocations,
        remainingBackups,
        remainingServers,
        isExpired,
      },
      servers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load user resources" }, { status: 500 });
  }
}
