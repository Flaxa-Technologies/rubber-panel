import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

type AdminUser = { id: string; email: string; role: string; username: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

const createUserSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF", "USER"]).default("USER"),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]).default("ACTIVE"),
});

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const roleFilter = searchParams.get("role");
  const statusFilter = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { username: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (roleFilter) where.role = roleFilter;
  if (statusFilter) where.status = statusFilter;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, username: true, email: true, role: true, status: true,
        emailVerified: true, createdAt: true, lastLoginAt: true,
        _count: { select: { servers: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.USERS_CREATE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { username, email, password, role, status } = parsed.data;

  const roleHierarchy: Record<string, number> = {
    SUPER_ADMIN: 4, ADMIN: 3, STAFF: 2, USER: 1,
  };
  if ((roleHierarchy[role] ?? 0) >= (roleHierarchy[actor.role] ?? 0)) {
    return NextResponse.json({ error: "Cannot create user with equal or higher role" }, { status: 403 });
  }

  const existing = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) {
    return NextResponse.json({ error: "Email or username already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { username, email, passwordHash, role, status },
    select: { id: true, username: true, email: true, role: true, status: true, createdAt: true },
  });

  await createAuditLog({
    actorId: actor.id, actorEmail: actor.email,
    action: "USER_CREATED",
    target: user.email, targetId: user.id,
    ipAddress: getIpFromRequest(request),
    metadata: { username, email, role },
  });

  return NextResponse.json(user, { status: 201 });
}
