import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUri = `${APP_URL}/api/auth/gdrive/callback`;

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/user/servers/${id}/backups/gdrive/auth?userId=${userId}&redirectUri=${encodeURIComponent(redirectUri)}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate Google auth URL" }, { status: 500 });
  }
}
