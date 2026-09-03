import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// GET /api/user/servers/[id]/databases — List databases
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/databases`,
    { userId }
  );

  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

// POST /api/user/servers/[id]/databases — Create database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/databases`,
    {
      method: "POST",
      userId,
      body,
    }
  );

  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
