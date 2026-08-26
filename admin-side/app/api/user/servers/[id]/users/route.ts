import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyServerAccess, PERMISSION_GROUPS, ROLE_PRESETS } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

// GET /api/user/servers/[id]/users — List subusers & permission presets
export async function GET(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const access = await verifyServerAccess(id, userId, "user.view");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      owner: { select: { id: true, username: true, email: true } },
      subusers: {
        select: {
          id: true,
          userId: true,
          roleName: true,
          permissions: true,
          createdAt: true,
          user: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  return NextResponse.json({
    owner: server.owner,
    subusers: server.subusers,
    permissionGroups: PERMISSION_GROUPS,
    rolePresets: ROLE_PRESETS,
    isOwner: access.isOwner,
  });
}

// POST /api/user/servers/[id]/users — Invite subuser by email
export async function POST(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const access = await verifyServerAccess(id, userId, "user.create");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const email = (body.email || "").trim().toLowerCase();
  const roleName = body.roleName || "Custom";
  const permissions = Array.isArray(body.permissions)
    ? JSON.stringify(body.permissions)
    : String(body.permissions || "[]");

  if (!email) {
    return NextResponse.json({ error: "User email is required" }, { status: 400 });
  }

  // Find target user
  const targetUser = await db.user.findUnique({ where: { email } });
  if (!targetUser) {
    return NextResponse.json({
      error: `No registered account found with email '${email}'. Please ask them to sign up first.`,
    }, { status: 404 });
  }

  const server = await db.server.findUnique({ where: { id }, select: { ownerId: true } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.ownerId === targetUser.id) {
    return NextResponse.json({ error: "Cannot add the server owner as a subuser." }, { status: 400 });
  }

  // Check if already invited
  const existing = await db.serverSubuser.findUnique({
    where: { serverId_userId: { serverId: id, userId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "This user is already a collaborator on this server." }, { status: 409 });
  }

  const subuser = await db.serverSubuser.create({
    data: {
      serverId: id,
      userId: targetUser.id,
      roleName,
      permissions,
    },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });

  return NextResponse.json({ success: true, subuser });
}
