import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { applyQuotaSuspensionState } from "@/lib/quota-service";
import { z } from "zod";

const quotaSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(64).default("Custom Resource Pool"),
  maxRam: z.number().int().min(128).max(524288), // MB (up to 512GB)
  maxCpu: z.number().int().min(10).max(6400),    // % (up to 64 cores)
  maxDisk: z.number().int().min(512).max(10485760), // MB (up to 10TB)
  maxServers: z.number().int().min(1).max(100).default(3),
  maxBackups: z.number().int().min(0).max(50).default(5),
  maxAllocations: z.number().int().min(0).max(50).default(3),
  allowServerCreation: z.boolean().default(false),
  isSuspended: z.boolean().default(false),
  suspendedReason: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  gracePeriodDays: z.number().int().min(0).max(365).default(3),
  onExpireAction: z.enum(["SUSPEND_SERVERS", "FREEZE_SCALE", "DELETE_SERVERS", "NOTIFY_ONLY"]).default("SUSPEND_SERVERS"),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const isInternal = internalSecret && expectedSecret && internalSecret === expectedSecret;

  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!isInternal && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [quotas, users] = await Promise.all([
      db.userResourceQuota.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              status: true,
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
                  allocations: { select: { id: true, port: true } },
                  backups: { select: { id: true } },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.user.findMany({
        where: { role: { in: ["USER", "STAFF", "ADMIN", "SUPER_ADMIN"] } },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
          servers: {
            select: { id: true, name: true, ram: true, cpu: true, disk: true, status: true },
          },
          resourceQuota: true,
        },
        orderBy: { email: "asc" },
      }),
    ]);

    // Compute live resource usage metrics for each quota (ONLY count extra quota usage or quota-created servers)
    const formattedQuotas = quotas.map((q) => {
      const servers = q.user.servers || [];
      let usedRam = 0;
      let usedCpu = 0;
      let usedDisk = 0;
      let usedAllocations = 0;
      let usedBackups = 0;
      let quotaServersCount = 0;

      for (const s of servers) {
        if (s.isCreatedFromQuota) {
          usedRam += s.ram;
          usedCpu += s.cpu;
          usedDisk += s.disk;
          quotaServersCount += 1;
          usedAllocations += (s.allocations?.length || 1);
          usedBackups += (s.backups?.length || 0);
        } else {
          usedRam += (s.extraRam || 0);
          usedCpu += (s.extraCpu || 0);
          usedDisk += (s.extraDisk || 0);
          usedAllocations += Math.max(0, (s.allocations?.length || 1) - 1);
        }
      }

      const now = new Date();
      const isExpired = q.expiresAt ? new Date(q.expiresAt) < now : false;
      let isInGracePeriod = false;
      if (isExpired && q.expiresAt) {
        const graceEnd = new Date(q.expiresAt);
        graceEnd.setDate(graceEnd.getDate() + q.gracePeriodDays);
        isInGracePeriod = graceEnd > now;
      }

      return {
        ...q,
        usedRam,
        usedCpu,
        usedDisk,
        usedAllocations,
        usedBackups,
        serverCount: quotaServersCount,
        remainingRam: Math.max(0, q.maxRam - usedRam),
        remainingCpu: Math.max(0, q.maxCpu - usedCpu),
        remainingDisk: Math.max(0, q.maxDisk - usedDisk),
        remainingAllocations: Math.max(0, q.maxAllocations - usedAllocations),
        remainingBackups: Math.max(0, q.maxBackups - usedBackups),
        remainingServers: Math.max(0, q.maxServers - quotaServersCount),
        isExpired,
        isInGracePeriod,
      };
    });

    return NextResponse.json({
      quotas: formattedQuotas,
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status,
        hasQuota: !!u.resourceQuota,
        serverCount: u.servers.length,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load resource quotas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = quotaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const quota = await db.userResourceQuota.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        name: data.name,
        maxRam: data.maxRam,
        maxCpu: data.maxCpu,
        maxDisk: data.maxDisk,
        maxServers: data.maxServers,
        maxBackups: data.maxBackups,
        maxAllocations: data.maxAllocations,
        allowServerCreation: data.allowServerCreation,
        isSuspended: data.isSuspended,
        suspendedReason: data.suspendedReason,
        expiresAt,
        gracePeriodDays: data.gracePeriodDays,
        onExpireAction: data.onExpireAction,
        notes: data.notes,
      },
      update: {
        name: data.name,
        maxRam: data.maxRam,
        maxCpu: data.maxCpu,
        maxDisk: data.maxDisk,
        maxServers: data.maxServers,
        maxBackups: data.maxBackups,
        maxAllocations: data.maxAllocations,
        allowServerCreation: data.allowServerCreation,
        isSuspended: data.isSuspended,
        suspendedReason: data.suspendedReason,
        expiresAt,
        gracePeriodDays: data.gracePeriodDays,
        onExpireAction: data.onExpireAction,
        notes: data.notes,
      },
    });

    if (data.isSuspended !== undefined) {
      await applyQuotaSuspensionState(
        data.userId,
        data.isSuspended,
        data.suspendedReason || "QUOTA_FROZEN"
      );
    }

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "USER_UPDATED" as any,
      target: user.email,
      targetId: user.id,
      metadata: {
        action: "RESOURCE_QUOTA_GRANTED",
        maxRam: data.maxRam,
        maxCpu: data.maxCpu,
        maxDisk: data.maxDisk,
        allowServerCreation: data.allowServerCreation,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      quota,
      message: `Resource quota configured successfully for ${user.email}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to configure resource quota" }, { status: 500 });
  }
}
