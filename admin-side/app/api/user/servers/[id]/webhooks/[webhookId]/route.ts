import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";
import db from "@/lib/db";

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { id, webhookId } = await params;
    const { internalSecret, expectedSecret, userId } = getAuthHeaders(req);

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const access = await verifyServerAccess(id, userId, "settings.view");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { name, url, events, enabled } = body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (url !== undefined) data.url = url.trim();
    if (events !== undefined) {
      data.events = Array.isArray(events) ? JSON.stringify(events) : events;
    }
    if (enabled !== undefined) data.enabled = Boolean(enabled);

    const updated = await db.serverWebhook.update({
      where: { id: webhookId, serverId: id },
      data,
    });

    return NextResponse.json({ success: true, webhook: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update webhook" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { id, webhookId } = await params;
    const { internalSecret, expectedSecret, userId } = getAuthHeaders(req);

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const access = await verifyServerAccess(id, userId, "settings.view");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    await db.serverWebhook.delete({
      where: { id: webhookId, serverId: id },
    });

    return NextResponse.json({ success: true, deleted: webhookId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete webhook" }, { status: 500 });
  }
}
