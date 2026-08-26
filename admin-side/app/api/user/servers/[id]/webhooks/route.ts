import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";
import db from "@/lib/db";

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { internalSecret, expectedSecret, userId } = getAuthHeaders(req);

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const access = await verifyServerAccess(id, userId, "settings.view");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const webhooks = await db.serverWebhook.findMany({
      where: { serverId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ webhooks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch webhooks" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!name || !url) {
      return NextResponse.json({ error: "Name and Webhook URL are required" }, { status: 400 });
    }

    const webhook = await db.serverWebhook.create({
      data: {
        serverId: id,
        name: name.trim(),
        url: url.trim(),
        events: Array.isArray(events) ? JSON.stringify(events) : typeof events === "string" ? events : "[\"server.start\",\"server.stop\",\"server.crash\"]",
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json({ success: true, webhook });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create webhook" }, { status: 500 });
  }
}
