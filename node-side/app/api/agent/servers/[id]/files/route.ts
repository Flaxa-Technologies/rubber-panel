import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { listFiles, readFileContent, writeFileContent, uploadFile, unzipFile, deleteFileOrDir } from "@/lib/server-manager";

// GET /api/agent/servers/[id]/files?path=/
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") || "list";
  const filePath = searchParams.get("path") || "/";
  const { id } = await params;

  try {
    if (action === "read") {
      const content = await readFileContent(id, filePath);
      return NextResponse.json({ content });
    } else {
      const files = await listFiles(id, filePath);
      return NextResponse.json({ files });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// POST /api/agent/servers/[id]/files — Write file, upload binary, or unzip
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const filePath = body.path;
  const action = body.action || "write";
  const { id } = await params;

  if (!filePath) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  try {
    if (action === "upload" && body.base64Content) {
      await uploadFile(id, filePath, body.base64Content);
      return NextResponse.json({ success: true, message: "File uploaded successfully" });
    } else if (action === "unzip") {
      await unzipFile(id, filePath, body.destination);
      return NextResponse.json({ success: true, message: "Archive extracted successfully" });
    } else {
      await writeFileContent(id, filePath, body.content ?? "");
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE /api/agent/servers/[id]/files?path=/file.txt
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAgentToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("path");
  const { id } = await params;

  if (!filePath) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  try {
    await deleteFileOrDir(id, filePath);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
