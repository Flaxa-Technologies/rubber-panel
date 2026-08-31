import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// POST /api/user/servers/[id]/allocations/[allocId]/primary — Proxy to admin API
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, allocId } = await params;

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/allocations/${allocId}/primary`,
    {
      method: "POST",
      userId,
    }
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
