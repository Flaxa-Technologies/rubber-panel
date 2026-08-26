import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// PATCH /api/user/servers/[id]/settings — Update server name/startup command
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { id } = await params;
  const body = await request.json();

  const { data, error, status } = await adminApiFetch<object>(
    `/api/user/servers/${id}/settings`,
    {
      method: "PATCH",
      userId,
      body: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.startupCommand !== undefined ? { startupCommand: body.startupCommand } : {}),
        ...(body.javaVersion !== undefined ? { javaVersion: body.javaVersion } : {}),
        ...(body.javaVersionId !== undefined ? { javaVersionId: body.javaVersionId } : {}),
        ...(body.cryoSleepMotd !== undefined ? { cryoSleepMotd: body.cryoSleepMotd } : {}),
      },
    }
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
