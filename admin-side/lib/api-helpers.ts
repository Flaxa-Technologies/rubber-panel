import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./next-auth";
import { hasPermission, PERMISSIONS, isAdminRole, type Role } from "./rbac";

type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  username: string;
}

// Middleware helper for admin API routes
export async function withAdminAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: AdminUser) => Promise<NextResponse>,
  requiredPermission?: Permission
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as AdminUser;

  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden — admin access only" }, { status: 403 });
  }

  if (requiredPermission && !hasPermission(user.role as Role, requiredPermission)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  return handler(request, user);
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function successResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
