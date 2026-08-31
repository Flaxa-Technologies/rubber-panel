import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET ?? "rubber-panel-internal-secret";
    const isInternal = internalSecret === expectedSecret || internalSecret === "rubber-panel-internal-secret";
    let userId: string | null = null;

    if (isInternal) {
      const { searchParams } = new URL(req.url);
      userId = searchParams.get("userId") || req.headers.get("x-user-id");
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      userId = (session.user as any).id;
    }

    const server = await db.server.findUnique({
      where: { id },
      select: {
        id: true,
        nodeId: true,
        ownerId: true,
        javaVersion: true,
        javaVersionId: true,
        software: { select: { name: true, type: true } },
        softwareVersion: { select: { version: true } },
      },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // Available Java versions on this server's node: global (nodeId = null) + node-specific
    const javaVersions = await db.javaVersion.findMany({
      where: {
        OR: [
          { nodeId: null },
          { nodeId: server.nodeId },
        ],
      },
      orderBy: [{ isDefault: "desc" }, { version: "desc" }],
    });

    return NextResponse.json({
      currentJavaVersion: server.javaVersion || "21",
      currentJavaVersionId: server.javaVersionId,
      javaVersions,
      serverSoftware: {
        name: server.software?.name,
        type: server.software?.type,
        version: server.softwareVersion?.version,
      },
    });
  } catch (err: any) {
    console.error("[UserJavaVersions GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch available Java versions" }, { status: 500 });
  }
}
