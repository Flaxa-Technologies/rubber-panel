import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// PATCH /api/user/servers/[id]/databases/[dbId] — Rotate password
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, dbId } = await params;

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/databases/${dbId}`,
    {
      method: "PATCH",
      userId,
    }
  );

  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

// DELETE /api/user/servers/[id]/databases/[dbId] — Delete database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dbId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id, dbId } = await params;

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/databases/${dbId}`,
    {
      method: "DELETE",
      userId,
    }
  );

  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
