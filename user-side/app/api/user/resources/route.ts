import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/user/resources?userId=${userId}`, {
      headers: {
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load resources" }, { status: 500 });
  }
}
