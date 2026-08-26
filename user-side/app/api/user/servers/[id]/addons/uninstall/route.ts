import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await context.params;
  const body = await request.json();

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/addons/uninstall`, {
    method: "DELETE",
    userId,
    body,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
