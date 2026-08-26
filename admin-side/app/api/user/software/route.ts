import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sortVersionItems } from "@/lib/minecraft-versions";

export async function GET(req: NextRequest) {
  try {
    const rawSoftware = await db.software.findMany({
      include: {
        versions: true,
      },
      orderBy: { name: "asc" },
    });

    const software = rawSoftware.map(s => ({
      ...s,
      versions: sortVersionItems(s.versions),
    }));

    return NextResponse.json({ software });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load software" }, { status: 500 });
  }
}
