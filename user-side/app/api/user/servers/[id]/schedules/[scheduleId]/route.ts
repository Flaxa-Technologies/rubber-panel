import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

// PATCH /api/user/servers/[id]/schedules/[scheduleId] — Update schedule
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, scheduleId } = await context.params;
  const body = await request.json();

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/schedules/${scheduleId}`, {
    method: "PATCH",
    userId,
    body,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

// DELETE /api/user/servers/[id]/schedules/[scheduleId] — Delete schedule
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, scheduleId } = await context.params;

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/schedules/${scheduleId}`, {
    method: "DELETE",
    userId,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
