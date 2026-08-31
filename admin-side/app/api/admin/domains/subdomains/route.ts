import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import db from "@/lib/db";

type AdminUser = { id: string; email: string; role: string };

async function getActor(request: NextRequest): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as AdminUser) : null;
}

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const subdomains = await db.subdomain.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            provider: true,
            isVerified: true,
            status: true,
          },
        },
        server: {
          select: {
            id: true,
            name: true,
            serverType: true,
            nodeId: true,
            node: {
              select: {
                id: true,
                name: true,
                fqdn: true,
                location: true,
              },
            },
            allocations: {
              take: 1,
              select: { ip: true, port: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ subdomains });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch subdomains" }, { status: 500 });
  }
}
