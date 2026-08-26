import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

type RouteContext = { params: Promise<{ id: string; webhookId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, webhookId } = await context.params;

  const { data, error, status } = await adminApiFetch<object>(`/api/user/servers/${id}/webhooks/${webhookId}/test`, {
    method: "POST",
    userId,
  });
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
