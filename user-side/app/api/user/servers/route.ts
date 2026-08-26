import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// GET /api/user/servers — Get current user's servers from admin API
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const { data, error, status } = await adminApiFetch<{ servers: unknown[] }>("/api/user/servers", { userId });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
