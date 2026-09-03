import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

// POST /api/node/sftp/auth — Node daemon SFTP client authentication
export async function POST(request: NextRequest) {
  try {
    const nodeToken = request.headers.get("x-node-token") || request.headers.get("authorization")?.replace("Bearer ", "");
    if (!nodeToken) {
      return NextResponse.json({ success: false, error: "Missing node token" }, { status: 401 });
    }

    const node = await db.node.findUnique({
      where: { authToken: nodeToken },
      select: { id: true, name: true },
    });

    if (!node) {
      return NextResponse.json({ success: false, error: "Invalid node token" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawUsername = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!rawUsername || !password) {
      return NextResponse.json({ success: false, error: "Username and password required" }, { status: 400 });
    }

    // Expected format: <user_identifier>.<server_identifier>
    // e.g. "admin.81173e26" or "prasad@flaxa.com.0cc021c0"
    let userIdentifier = rawUsername;
    let serverIdentifier = String(body.serverId || "").trim();

    if (rawUsername.includes(".")) {
      const lastDotIndex = rawUsername.lastIndexOf(".");
      userIdentifier = rawUsername.slice(0, lastDotIndex);
      serverIdentifier = rawUsername.slice(lastDotIndex + 1);
    }

    if (!serverIdentifier) {
      return NextResponse.json({
        success: false,
        error: "SFTP username format must be <username>.<serverShortId> (e.g. admin.81173e26)",
      }, { status: 400 });
    }

    // 1. Locate User by username or email
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: userIdentifier },
          { email: userIdentifier },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // 2. Locate Server by ID prefix or UUID prefix
    const servers = await db.server.findMany({
      where: {
        nodeId: node.id,
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        ownerId: true,
        sftpEnabled: true,
        suspended: true,
        allowedPaths: true,
        protectedPaths: true,
        subusers: {
          select: {
            userId: true,
            permissions: true,
          },
        },
      },
    });

    const targetServer = servers.find((s) => {
      const sId = s.id.toLowerCase();
      const sUuid = s.uuid.toLowerCase();
      const target = serverIdentifier.toLowerCase();
      return (
        sId === target ||
        sUuid === target ||
        sId.startsWith(target) ||
        sUuid.startsWith(target)
      );
    });

    if (!targetServer) {
      return NextResponse.json({
        success: false,
        error: `Server identifier '${serverIdentifier}' not found on this node.`,
      }, { status: 404 });
    }

    // Check if server is suspended
    if (targetServer.suspended) {
      return NextResponse.json({ success: false, error: "Server is suspended." }, { status: 403 });
    }

    // Check if SFTP access is enabled
    if (targetServer.sftpEnabled === false) {
      return NextResponse.json({ success: false, error: "SFTP access is disabled for this server." }, { status: 403 });
    }

    // 3. Check User Permissions
    const isOwner = targetServer.ownerId === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const subuser = targetServer.subusers.find((sub) => sub.userId === user.id);

    let hasFileAccess = isOwner || isAdmin;
    if (!hasFileAccess && subuser) {
      try {
        const perms: string[] = JSON.parse(subuser.permissions || "[]");
        hasFileAccess = perms.includes("files.*") || perms.includes("files.read") || perms.includes("*");
      } catch {}
    }

    if (!hasFileAccess) {
      return NextResponse.json({ success: false, error: "Access denied to server files." }, { status: 403 });
    }

    let allowedPaths: string[] = ["/"];
    let protectedPaths: string[] = [];
    try {
      if (targetServer.allowedPaths) allowedPaths = JSON.parse(targetServer.allowedPaths);
      if (targetServer.protectedPaths) protectedPaths = JSON.parse(targetServer.protectedPaths);
    } catch {}

    return NextResponse.json({
      success: true,
      serverId: targetServer.id,
      serverUuid: targetServer.uuid,
      serverName: targetServer.name,
      username: user.username,
      allowedPaths,
      protectedPaths,
    });
  } catch (err: any) {
    console.error("[SFTP Auth API Error]", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal auth error" }, { status: 500 });
  }
}
