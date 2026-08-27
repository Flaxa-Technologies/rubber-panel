import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET /api/user/servers — Returns servers owned by or shared with the authenticated user
export async function GET(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const servers = await db.server.findMany({
    where: isAdmin
      ? {}
      : {
          OR: [
            { ownerId: userId },
            { subusers: { some: { userId } } },
          ],
        },
    select: {
      id: true,
      name: true,
      uuid: true,
      status: true,
      suspended: true,
      ram: true,
      cpu: true,
      disk: true,
      createdAt: true,
      ownerId: true,
      cryoSleepEnabled: true,
      cryoSleepIdleMinutes: true,
      cryoSleepCustomMotdAllowed: true,
      cryoSleepMotd: true,
      node: { select: { id: true, name: true, status: true, fqdn: true, port: true } },
      software: { select: { name: true, type: true } },
      softwareVersion: { select: { version: true } },
      allocations: { select: { id: true, ip: true, port: true }, orderBy: { createdAt: "asc" }, take: 1 },
      subusers: {
        where: { userId },
        select: { roleName: true, permissions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = servers.map(s => ({
    ...s,
    isOwner: s.ownerId === userId,
    subuserRole: s.subusers[0]?.roleName ?? (s.ownerId === userId ? "Owner" : "Admin"),
    subuserPermissions: s.subusers[0]?.permissions ?? "[\"*\"]",
  }));

  return NextResponse.json({ servers: formatted });
}
