import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isAdminRole, hasPermission, PERMISSIONS, canManageRole } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

async function getActor(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; email: string; role: string; username: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, email: true, role: true, status: true,
      emailVerified: true, createdAt: true, updatedAt: true,
      lastLoginAt: true, lastLoginIp: true,
      servers: { select: { id: true, name: true, status: true, createdAt: true }, take: 10 },
      _count: { select: { servers: true, apiKeys: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

const updateUserSchema = z.object({
  username: z.string().min(3).max(32).optional(),
  email: z.string().email().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF", "USER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]).optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.USERS_EDIT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!canManageRole(actor.role, target.role)) {
    return NextResponse.json({ error: "Cannot modify user with equal or higher role" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.username) data.username = parsed.data.username;
  if (parsed.data.email) data.email = parsed.data.email;
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, username: true, email: true, role: true, status: true },
  });

  let action: any = "USER_UPDATED";
  if (parsed.data.status === "SUSPENDED") action = "USER_SUSPENDED";
  else if (parsed.data.status === "ACTIVE" && target.status === "SUSPENDED") action = "USER_UNSUSPENDED";
  else if (parsed.data.password) action = "USER_PASSWORD_RESET";

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email, action,
    target: target.email, targetId: target.id,
    ipAddress: getIpFromRequest(request),
    metadata: { changes: Object.keys(data) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.USERS_DELETE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (actor.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!canManageRole(actor.role, target.role)) {
    return NextResponse.json({ error: "Cannot delete user with equal or higher role" }, { status: 403 });
  }

  await db.user.delete({ where: { id } });
  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "USER_DELETED",
    target: target.email, targetId: target.id,
    ipAddress: getIpFromRequest(request),
    metadata: { username: target.username, email: target.email },
  });

  return NextResponse.json({ success: true });
}
