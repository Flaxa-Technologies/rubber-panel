import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { url, name } = body;

    if (!url) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    const payload = {
      username: "Rubber Panel",
      content: null,
      embeds: [
        {
          title: "🔌 Webhook Test Notification",
          description: `Test notification successfully dispatched for webhook **"${name || "Server Webhook"}"**.`,
          color: 65280, // emerald green
          fields: [
            { name: "Server Instance", "value": `\`${id}\``, "inline": true },
            { name: "Event Type", "value": "test.ping", "inline": true },
            { name: "Delivery State", "value": "✅ Success", "inline": true },
          ],
          footer: { text: "Rubber Panel Automation Engine" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    console.log(`[WebhookTest] Sending test payload to ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Webhook endpoint returned status ${res.status}: ${errText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      deliveredTo: url,
      statusCode: res.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to trigger webhook test" }, { status: 500 });
  }
}
