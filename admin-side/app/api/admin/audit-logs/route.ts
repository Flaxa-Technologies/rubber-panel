import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole, hasPermission, PERMISSIONS } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role) || !hasPermission(actor.role as any, PERMISSIONS.AUDIT_LOGS_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const action = searchParams.get("action");
  const actorId = searchParams.get("actorId");
  const result = searchParams.get("result");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { action: { contains: search } },
      { target: { contains: search } },
      { actorEmail: { contains: search } },
    ];
  }
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;
  if (result) where.result = result;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, actorEmail: true, action: true, target: true, targetId: true,
        result: true, ipAddress: true, metadata: true, createdAt: true,
        actor: { select: { id: true, username: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
