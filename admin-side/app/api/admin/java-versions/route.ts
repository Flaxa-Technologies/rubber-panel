import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";

const DEFAULT_JAVA_VERSIONS = [
  {
    name: "Java 21 (Recommended LTS)",
    version: "21",
    dockerImage: "itzg/minecraft-server:java21",
    binaryPath: "java",
    isDefault: true,
    description: "Recommended LTS runtime for modern Minecraft 1.20.5+ and 1.21.x",
  },
  {
    name: "Java 17 (LTS)",
    version: "17",
    dockerImage: "itzg/minecraft-server:java17",
    binaryPath: "java",
    isDefault: false,
    description: "Standard LTS runtime for Minecraft 1.17 through 1.20.4",
  },
  {
    name: "Java 8 (Legacy)",
    version: "8",
    dockerImage: "itzg/minecraft-server:java8",
    binaryPath: "java",
    isDefault: false,
    description: "Required for vintage Minecraft 1.12.2 and older modpacks",
  },
  {
    name: "Java 25 (Early Access)",
    version: "25",
    dockerImage: "itzg/minecraft-server:java25",
    binaryPath: "java",
    isDefault: false,
    description: "Next-generation Java 25 development runtime",
  },
  {
    name: "Java 23",
    version: "23",
    dockerImage: "itzg/minecraft-server:java23",
    binaryPath: "java",
    isDefault: false,
    description: "Cutting-edge Java 23 development runtime",
  },
  {
    name: "Java 22",
    version: "22",
    dockerImage: "itzg/minecraft-server:java22",
    binaryPath: "java",
    isDefault: false,
    description: "Modern performance release with latest JVM optimizations",
  },
  {
    name: "Java 21 (LTS)",
    version: "21",
    dockerImage: "itzg/minecraft-server:java21",
    binaryPath: "java",
    isDefault: true,
    description: "Recommended runtime for modern Minecraft 1.20.5+ and 1.21.x",
  },
  {
    name: "Java 17 (LTS)",
    version: "17",
    dockerImage: "itzg/minecraft-server:java17",
    binaryPath: "java",
    isDefault: false,
    description: "Standard LTS runtime for Minecraft 1.17 through 1.20.4",
  },
  {
    name: "Java 11 (LTS)",
    version: "11",
    dockerImage: "itzg/minecraft-server:java11",
    binaryPath: "java",
    isDefault: false,
    description: "Legacy LTS runtime for Minecraft 1.16 through 1.16.5",
  },
  {
    name: "Java 8 (Legacy)",
    version: "8",
    dockerImage: "itzg/minecraft-server:java8",
    binaryPath: "java",
    isDefault: false,
    description: "Required for vintage Minecraft 1.12.2 and older modpacks",
  },
];

async function ensureDefaultJavaVersions() {
  for (const jv of DEFAULT_JAVA_VERSIONS) {
    const existing = await db.javaVersion.findFirst({
      where: { version: jv.version, nodeId: null },
    });
    if (!existing) {
      await db.javaVersion.create({ data: jv });
      console.log(`[JavaVersions] Added runtime: ${jv.name}`);
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const isInternal = req.headers.get("x-internal-secret") === "rubber-panel-internal-secret";
    if (!isInternal) {
      const session = await getServerSession(authOptions);
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDefaultJavaVersions();

    const { searchParams } = new URL(req.url);
    const nodeId = searchParams.get("nodeId");

    const where: any = {};
    if (nodeId) {
      where.OR = [
        { nodeId: null },
        { nodeId: nodeId },
      ];
    }

    const javaVersions = await db.javaVersion.findMany({
      where,
      include: {
        node: { select: { id: true, name: true, fqdn: true } },
        _count: { select: { servers: true } },
      },
      orderBy: [{ isDefault: "desc" }, { version: "desc" }],
    });

    return NextResponse.json({ javaVersions });
  } catch (err: any) {
    console.error("[JavaVersions GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch Java versions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isInternal = req.headers.get("x-internal-secret") === "rubber-panel-internal-secret";
    if (!isInternal) {
      const session = await getServerSession(authOptions);
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const actor = session.user as { role: string };
      if (!isAdminRole(actor.role)) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
      }
    }

    const body = await req.json();
    const { name, version, dockerImage, binaryPath, isDefault, nodeId, description } = body;

    if (!name || !version) {
      return NextResponse.json({ error: "Name and version number are required" }, { status: 400 });
    }

    if (isDefault) {
      // Unset previous default
      await db.javaVersion.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await db.javaVersion.create({
      data: {
        name: name.trim(),
        version: String(version).trim(),
        dockerImage: dockerImage?.trim() || `itzg/minecraft-server:java${String(version).trim()}`,
        binaryPath: binaryPath?.trim() || "java",
        isDefault: Boolean(isDefault),
        nodeId: nodeId || null,
        description: description?.trim() || null,
      },
      include: {
        node: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, javaVersion: created });
  } catch (err: any) {
    console.error("[JavaVersions POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create Java version" }, { status: 500 });
  }
}
