import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  const path = jobId
    ? `/api/user/servers/${id}/remote-sftp?jobId=${encodeURIComponent(jobId)}`
    : `/api/user/servers/${id}/remote-sftp`;

  const { data, error, status } = await adminApiFetch<object>(path, {
    userId,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await context.params;
  const body = await request.json();

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/remote-sftp`, {
    method: "POST",
    userId,
    body,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
