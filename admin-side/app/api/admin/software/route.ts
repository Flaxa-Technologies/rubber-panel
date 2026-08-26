import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { sortVersionItems } from "@/lib/minecraft-versions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rawSoftware = await db.software.findMany({
    include: { versions: true },
    orderBy: { name: "asc" },
  });

  const software = rawSoftware.map(s => ({
    ...s,
    versions: sortVersionItems(s.versions),
  }));
  
  return NextResponse.json({ software });
}
