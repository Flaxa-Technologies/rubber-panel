import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// POST /api/user/servers/[id]/radar/under-attack — Toggle Under Attack Mode
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;
  const body = await request.json();

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/radar/under-attack`,
    {
      method: "POST",
      userId,
      body,
    }
  );

  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
