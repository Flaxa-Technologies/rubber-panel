import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string; subuserId: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

// PATCH /api/user/servers/[id]/users/[subuserId] — Update subuser permissions
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id, subuserId } = await context.params;
  const access = await verifyServerAccess(id, userId, "user.edit");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, any> = {};
  if (body.roleName !== undefined) data.roleName = body.roleName;
  if (body.permissions !== undefined) {
    data.permissions = Array.isArray(body.permissions)
      ? JSON.stringify(body.permissions)
      : String(body.permissions);
  }

  const updated = await db.serverSubuser.update({
    where: { id: subuserId },
    data,
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  return NextResponse.json({ success: true, subuser: updated });
}

// DELETE /api/user/servers/[id]/users/[subuserId] — Remove subuser
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id, subuserId } = await context.params;
  const access = await verifyServerAccess(id, userId, "user.delete");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  await db.serverSubuser.delete({
    where: { id: subuserId },
  });

  return NextResponse.json({ success: true, message: "Collaborator removed successfully" });
}
