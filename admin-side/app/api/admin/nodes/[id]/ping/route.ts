import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { getNodeBaseUrl } from "@/lib/node-client";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const node = await db.node.findUnique({
    where: { id },
    select: { id: true, name: true, fqdn: true, port: true, authToken: true },
  });

  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const baseUrl = getNodeBaseUrl(node);
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${baseUrl}/api/agent/health`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${node.authToken}`,
        "X-Node-Id": node.id,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json();
      await db.node.update({
        where: { id: node.id },
        data: { status: "ONLINE", lastHeartbeat: new Date() },
      });
      return NextResponse.json({
        online: true,
        latencyMs,
        data,
      });
    } else {
      return NextResponse.json({
        online: false,
        latencyMs,
        status: res.status,
        error: `Agent returned HTTP ${res.status}`,
      });
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json({
      online: false,
      latencyMs,
      error: err.name === "AbortError" ? "Connection timed out (4s)" : err.message || "Failed to connect to agent",
    });
  }
}
