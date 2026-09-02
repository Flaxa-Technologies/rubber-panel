import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";

const DEFAULT_JAVA_VERSIONS = [
  {
    name: "Java 21 (Recommended LTS)",
    version: "21",
    dockerImage: "eclipse-temurin:21-jre-alpine",
    binaryPath: "java",
    isDefault: true,
    description: "Adoptium OpenJDK 21 LTS runtime for modern Minecraft 1.20.5+ and 1.21.x",
  },
  {
    name: "Java 17 (LTS)",
    version: "17",
    dockerImage: "eclipse-temurin:17-jre-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Adoptium OpenJDK 17 LTS runtime for Minecraft 1.17 through 1.20.4",
  },
  {
    name: "Java 11 (LTS)",
    version: "11",
    dockerImage: "eclipse-temurin:11-jre-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Adoptium OpenJDK 11 LTS runtime for Minecraft 1.16 through 1.16.5",
  },
  {
    name: "Java 8 (Legacy)",
    version: "8",
    dockerImage: "eclipse-temurin:8-jre-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Adoptium OpenJDK 8 Legacy runtime for vintage Minecraft 1.12.2 and older modpacks",
  },
  {
    name: "Java 21 GraalVM (High Performance)",
    version: "21-graalvm",
    dockerImage: "ghcr.io/graalvm/jdk-community:21",
    binaryPath: "java",
    isDefault: false,
    description: "Optimized GraalVM high-performance JIT runtime for Minecraft 1.21+",
  },
  {
    name: "Java 17 GraalVM",
    version: "17-graalvm",
    dockerImage: "ghcr.io/graalvm/jdk-community:17",
    binaryPath: "java",
    isDefault: false,
    description: "High-performance GraalVM runtime for Minecraft 1.18 - 1.20.4",
  },
  {
    name: "Java 22",
    version: "22",
    dockerImage: "eclipse-temurin:22-jdk-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Adoptium OpenJDK 22 performance release",
  },
  {
    name: "Java 23",
    version: "23",
    dockerImage: "eclipse-temurin:23-jdk-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Adoptium OpenJDK 23 modern runtime",
  },
  {
    name: "Java 25 (Early Access)",
    version: "25",
    dockerImage: "eclipse-temurin:25-jdk-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Next-generation OpenJDK 25 early access development runtime",
  },
  {
    name: "Amazon Corretto 21",
    version: "corretto-21",
    dockerImage: "amazoncorretto:21-alpine",
    binaryPath: "java",
    isDefault: false,
    description: "Amazon Corretto multiplatform production-ready OpenJDK 21",
  },
  {
    name: "Azul Zulu 21",
    version: "zulu-21",
    dockerImage: "azul/zulu-openjdk-alpine:21-jre",
    binaryPath: "java",
    isDefault: false,
    description: "Azul Zulu tested and certified OpenJDK 21 build",
  },
];

async function ensureDefaultJavaVersions() {

  // 2. Ensure verified LTS versions exist and are correctly configured
  let defaultJava21Id: string | null = null;
  for (const jv of DEFAULT_JAVA_VERSIONS) {
    const existing = await db.javaVersion.findFirst({
      where: { version: jv.version, nodeId: null },
    });
    if (!existing) {
      const created = await db.javaVersion.create({ data: jv });
      if (jv.isDefault) defaultJava21Id = created.id;
      console.log(`[JavaVersions] Added runtime: ${jv.name}`);
    } else {
      if (jv.isDefault) defaultJava21Id = existing.id;
      await db.javaVersion.update({
        where: { id: existing.id },
        data: {
          name: jv.name,
          dockerImage: jv.dockerImage,
          isDefault: jv.isDefault,
          description: jv.description,
        },
      });
    }
  }

  // 3. Normalize any servers stuck on invalid versions (22, 23, 24, 25) back to Java 21
  if (defaultJava21Id) {
    try {
      await db.server.updateMany({
        where: {
          javaVersion: { in: ["22", "23", "24", "25"] },
        },
        data: {
          javaVersion: "21",
          javaVersionId: defaultJava21Id,
        },
      });
    } catch {}
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
