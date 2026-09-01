import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { getSettingBool, getSettingInt } from "@/lib/settings";

type UserSession = { id: string; email: string; role: string };

async function resolveUser(request: NextRequest): Promise<UserSession | null> {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id") || request.nextUrl.searchParams.get("userId");

  if (expectedSecret && internalSecret === expectedSecret && userId) {
    const dbUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (dbUser) return dbUser as UserSession;
    return { id: userId, email: "", role: "USER" };
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    return session.user as UserSession;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: serverId } = await params;
  try {
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: {
        subdomains: {
          include: {
            domain: {
              select: { id: true, name: true, provider: true, status: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const globalDefault = await getSettingInt("domains.defaultPerServer");
    const allowSubdomains = await getSettingBool("domains.allowSubdomains");

    let limit = globalDefault;
    if (server.customDomainLimit !== null && server.customDomainLimit !== -1) {
      limit = server.customDomainLimit;
    }

    return NextResponse.json({
      subdomains: server.subdomains,
      limit,
      used: server.subdomains.length,
      canCreate: allowSubdomains && limit > 0 && server.subdomains.length < limit,
      allowSubdomains,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch server subdomains" }, { status: 500 });
  }
}
