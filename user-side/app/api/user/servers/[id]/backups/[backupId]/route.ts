import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

// POST /api/user/servers/[id]/backups/[backupId] — Restore snapshot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { id, backupId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${ADMIN_API_URL}/api/user/servers/${id}/backups/${backupId}?userId=${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to restore backup" }, { status: 500 });
  }
}

// DELETE /api/user/servers/[id]/backups/[backupId] — Delete snapshot
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const { id, backupId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${ADMIN_API_URL}/api/user/servers/${id}/backups/${backupId}?userId=${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete backup" }, { status: 500 });
  }
}
