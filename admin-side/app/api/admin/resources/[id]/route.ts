import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { applyQuotaSuspensionState } from "@/lib/quota-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const isInternal = internalSecret && expectedSecret && internalSecret === expectedSecret;

  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!isInternal && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const quota = await db.userResourceQuota.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!quota) {
      return NextResponse.json({ error: "Resource quota not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.maxRam !== undefined) updateData.maxRam = parseInt(body.maxRam);
    if (body.maxCpu !== undefined) updateData.maxCpu = parseInt(body.maxCpu);
    if (body.maxDisk !== undefined) updateData.maxDisk = parseInt(body.maxDisk);
    if (body.maxServers !== undefined) updateData.maxServers = parseInt(body.maxServers);
    if (body.maxBackups !== undefined) updateData.maxBackups = parseInt(body.maxBackups);
    if (body.maxAllocations !== undefined) updateData.maxAllocations = parseInt(body.maxAllocations);
    if (body.allowServerCreation !== undefined) updateData.allowServerCreation = Boolean(body.allowServerCreation);
    if (body.isSuspended !== undefined) updateData.isSuspended = Boolean(body.isSuspended);
    if (body.suspendedReason !== undefined) updateData.suspendedReason = body.suspendedReason;
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.gracePeriodDays !== undefined) updateData.gracePeriodDays = parseInt(body.gracePeriodDays);
    if (body.onExpireAction !== undefined) updateData.onExpireAction = body.onExpireAction;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const updated = await db.userResourceQuota.update({
      where: { id },
      data: updateData,
    });

    // If quota suspension status changed or was explicitly set, apply hardware revocation/restoration
    if (updateData.isSuspended !== undefined) {
      await applyQuotaSuspensionState(
        quota.userId,
        updateData.isSuspended,
        updateData.suspendedReason || "QUOTA_FROZEN"
      );
    }

    await createAuditLog({
      actorId: actor?.id || quota.userId,
      actorEmail: actor?.email || "system",
      action: "USER_UPDATED" as any,
      target: quota.user.email,
      targetId: quota.user.id,
      metadata: { action: "QUOTA_MODIFIED", changes: Object.keys(updateData) },
    });

    return NextResponse.json({ success: true, quota: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update quota" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const isInternal = internalSecret && expectedSecret && internalSecret === expectedSecret;

  const session = await getServerSession(authOptions);
  const actor = session?.user as any;
  if (!isInternal && (!actor || !isAdminRole(actor.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const suspendServers = searchParams.get("suspendServers") === "true";

  try {
    const quota = await db.userResourceQuota.findUnique({
      where: { id },
      include: { user: { include: { servers: true } } },
    });

    if (!quota) {
      return NextResponse.json({ error: "Resource quota not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      if (suspendServers) {
        await tx.server.updateMany({
          where: { ownerId: quota.userId },
          data: {
            suspended: true,
            suspensionReason: "QUOTA_REVOKED",
          },
        });
      }

      await tx.userResourceQuota.delete({ where: { id } });
    });

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "USER_UPDATED" as any,
      target: quota.user.email,
      targetId: quota.user.id,
      metadata: { action: "QUOTA_REVOKED", suspendServers },
    });

    return NextResponse.json({ success: true, message: "Resource quota revoked successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to revoke quota" }, { status: 500 });
  }
}
