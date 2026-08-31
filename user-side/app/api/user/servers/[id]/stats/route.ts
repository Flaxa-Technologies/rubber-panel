import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// GET /api/user/servers/[id]/stats — Fetch real-time CPU, RAM, Disk, and Network telemetry
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/stats`,
    { userId }
  );

  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
