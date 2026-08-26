import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// GET /api/user/servers/[id]/files?path=/
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const userId = (session.user as any).id;
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") || "list";
  const filePath = searchParams.get("path") || "/";

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/files?action=${action}&path=${encodeURIComponent(filePath)}`, { userId });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

// POST /api/user/servers/[id]/files
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const userId = (session.user as any).id;
  const { id } = await params;
  const body = await request.json();

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/files`, {
    method: "POST",
    userId,
    body,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

// DELETE /api/user/servers/[id]/files?path=/
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const userId = (session.user as any).id;
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("path");

  if (!filePath) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
    userId,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
