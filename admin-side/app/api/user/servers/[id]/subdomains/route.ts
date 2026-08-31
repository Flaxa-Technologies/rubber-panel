import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { getSettingBool, getSettingInt } from "@/lib/settings";

type UserSession = { id: string; email: string; role: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as UserSession;

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
