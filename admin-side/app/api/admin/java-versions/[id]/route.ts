import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const isInternal = req.headers.get("x-internal-secret") === "rubber-panel-internal-secret";
    if (!isInternal) {
      const session = await getServerSession(authOptions);
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const javaVersion = await db.javaVersion.findUnique({
      where: { id },
      include: {
        node: { select: { id: true, name: true, fqdn: true } },
        _count: { select: { servers: true } },
      },
    });

    if (!javaVersion) {
      return NextResponse.json({ error: "Java version not found" }, { status: 404 });
    }

    return NextResponse.json({ javaVersion });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch Java version" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const existing = await db.javaVersion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Java version not found" }, { status: 404 });
    }

    if (isDefault) {
      await db.javaVersion.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await db.javaVersion.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(version !== undefined ? { version: String(version).trim() } : {}),
        ...(dockerImage !== undefined ? { dockerImage: dockerImage?.trim() || null } : {}),
        ...(binaryPath !== undefined ? { binaryPath: binaryPath?.trim() || null } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
        ...(nodeId !== undefined ? { nodeId: nodeId || null } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
      },
      include: {
        node: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, javaVersion: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update Java version" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const existing = await db.javaVersion.findUnique({
      where: { id },
      include: { _count: { select: { servers: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Java version not found" }, { status: 404 });
    }

    if (existing._count.servers > 0) {
      return NextResponse.json({
        error: `Cannot delete: ${existing._count.servers} server(s) are currently configured with this Java version. Please reassign them first.`,
      }, { status: 400 });
    }

    await db.javaVersion.delete({ where: { id } });

    return NextResponse.json({ success: true, message: `Java version "${existing.name}" deleted.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete Java version" }, { status: 500 });
  }
}
