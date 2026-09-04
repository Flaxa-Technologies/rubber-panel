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
        ...(body.softwareId !== undefined ? { softwareId: body.softwareId } : {}),
        ...(body.softwareType !== undefined ? { softwareType: body.softwareType } : {}),
        ...(body.softwareName !== undefined ? { softwareName: body.softwareName } : {}),
        ...(body.softwareVersionId !== undefined ? { softwareVersionId: body.softwareVersionId } : {}),
        ...(body.version !== undefined ? { version: body.version } : {}),
        ...(body.javaVersion !== undefined ? { javaVersion: body.javaVersion } : {}),
        ...(body.javaVersionId !== undefined ? { javaVersionId: body.javaVersionId } : {}),
        ...(body.nodeVersion !== undefined ? { nodeVersion: body.nodeVersion } : {}),
        ...(body.securityProtection !== undefined ? { securityProtection: body.securityProtection } : {}),
        ...(body.cryoSleepMotd !== undefined ? { cryoSleepMotd: body.cryoSleepMotd } : {}),
        ...(body.internalPort !== undefined ? { internalPort: body.internalPort } : {}),
        ...(body.environment !== undefined ? { environment: body.environment } : {}),
      },
    }
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
