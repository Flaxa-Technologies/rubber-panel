import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { verifyServerAccess } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  const bypass = request.headers.get("x-bypass-restrictions") === "true";
  return { internalSecret, expectedSecret, userId, bypass };
}

function parsePathList(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    if (val.startsWith("[")) {
      return JSON.parse(val);
    }
    return val.split(",").map(s => s.trim()).filter(Boolean);
  } catch {
    return val.split(",").map(s => s.trim()).filter(Boolean);
  }
}

function normalizePath(p: string): string {
  return "/" + p.replace(/^\/+/, "").replace(/\\/g, "/");
}

function isPathProtected(reqPath: string, protectedPaths: string[]): boolean {
  const norm = normalizePath(reqPath);
  for (const prot of protectedPaths) {
    const normProt = normalizePath(prot);
    if (norm === normProt || norm.startsWith(normProt + "/")) {
      return true;
    }
  }
  return false;
}

function isPathAllowed(reqPath: string, allowedPaths: string[]): boolean {
  if (!allowedPaths || allowedPaths.length === 0) return true;
  const norm = normalizePath(reqPath);

  for (const allow of allowedPaths) {
    const normAllow = normalizePath(allow);
    if (normAllow === "/" || normAllow === "") return true; // "/" = full access to all files
    if (norm === normAllow || norm.startsWith(normAllow + "/") || normAllow.startsWith(norm === "/" ? "/" : norm + "/")) {
      return true;
    }
  }
  return false;
}

// GET /api/user/servers/[id]/files?path=/
export async function GET(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId, bypass } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;

  const access = await verifyServerAccess(id, userId, "file.read");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true, status: true, allowedPaths: true, protectedPaths: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.status === "TRANSFERRING") {
    return NextResponse.json({ error: "Server is currently transferring to another node. File access is locked." }, { status: 423 });
  }

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "This instance is suspended. File access is locked." }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") || "list";
  const filePath = searchParams.get("path") || "/";

  // Check path allowances for non-admin or when bypass is disabled
  if (!access.isAdmin || !bypass) {
    const allowedList = parsePathList(server.allowedPaths);
    if (action === "read" && !isPathAllowed(filePath, allowedList)) {
      return NextResponse.json({ error: `Access denied: '${filePath}' is not in allowed paths (${allowedList.join(", ")}).` }, { status: 403 });
    }
  }

  const result = await sendNodeCommand(
    server.nodeId, 
    `/api/agent/servers/${server.id}/files?action=${action}&path=${encodeURIComponent(filePath)}`, 
    "GET"
  );

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data);
}

// POST /api/user/servers/[id]/files
export async function POST(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId, bypass } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const body = await request.json();
  const filePath = body.path || "/";
  const action = body.action || "write";

  const reqPerm = action === "upload" ? "file.upload" : action === "unzip" ? "file.archive" : "file.edit";
  const access = await verifyServerAccess(id, userId, reqPerm);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true, status: true, allowedPaths: true, protectedPaths: true, blockedUploadPaths: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.status === "TRANSFERRING") {
    return NextResponse.json({ error: "Server is currently transferring to another node. File modification is locked." }, { status: 423 });
  }

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "This instance is suspended. File modification is locked." }, { status: 403 });
  }

  // If not admin with bypass active, validate protections and allowances
  if (!access.isAdmin || !bypass) {
    if (action === "upload") {
      const blockedUploadList = parsePathList(server.blockedUploadPaths);
      if (isPathProtected(filePath, blockedUploadList)) {
        return NextResponse.json({ error: `Permission Denied: Uploads into '${filePath}' are restricted by administration.` }, { status: 403 });
      }
    }

    const protectedList = parsePathList(server.protectedPaths);
    if (isPathProtected(filePath, protectedList)) {
      return NextResponse.json({ error: `Permission Denied: '${filePath}' is a protected system file and cannot be modified or overwritten.` }, { status: 403 });
    }

    const allowedList = parsePathList(server.allowedPaths);
    if (!isPathAllowed(filePath, allowedList)) {
      return NextResponse.json({ error: `Permission Denied: '${filePath}' is outside your allowed directories (${allowedList.join(", ")}).` }, { status: 403 });
    }
  }

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/files`, "POST", body);

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data);
}

// DELETE /api/user/servers/[id]/files?path=/
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { internalSecret, expectedSecret, userId, bypass } = getAuthHeaders(request);
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  const access = await verifyServerAccess(id, userId, "file.delete");
  if (!access.allowed) {
    return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
  }

  const server = await db.server.findUnique({
    where: { id },
    select: { id: true, nodeId: true, suspended: true, status: true, allowedPaths: true, protectedPaths: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  if (server.status === "TRANSFERRING") {
    return NextResponse.json({ error: "Server is currently transferring to another node. File deletion is locked." }, { status: 423 });
  }

  if (server.suspended && !access.isAdmin) {
    return NextResponse.json({ error: "This instance is suspended. File deletion is locked." }, { status: 403 });
  }

  if (!access.isAdmin || !bypass) {
    const protectedList = parsePathList(server.protectedPaths);
    if (isPathProtected(filePath, protectedList)) {
      return NextResponse.json({ error: `Permission Denied: '${filePath}' is a protected file and cannot be deleted.` }, { status: 403 });
    }

    const allowedList = parsePathList(server.allowedPaths);
    if (!isPathAllowed(filePath, allowedList)) {
      return NextResponse.json({ error: `Permission Denied: '${filePath}' is outside your allowed directories.` }, { status: 403 });
    }
  }

  const result = await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/files?path=${encodeURIComponent(filePath)}`, "DELETE");

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.data);
}
