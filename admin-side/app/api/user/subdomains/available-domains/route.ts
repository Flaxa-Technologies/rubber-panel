import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { getSettingBool } from "@/lib/settings";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const isEnabled = await getSettingBool("domains.allowSubdomains");
    if (!isEnabled) {
      return NextResponse.json({ domains: [], enabled: false });
    }

    const domains = await db.domain.findMany({
      where: {
        status: "ACTIVE",
        isVerified: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        provider: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ domains, enabled: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch domains" }, { status: 500 });
  }
}
