import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import {
  banIp,
  unbanIp,
  setFleetShieldMode,
  setServerUnderAttack,
  updateTrustedIps,
  updateServerThresholds,
} from "@/lib/radar-engine";

// POST /api/agent/radar/action — Execute ban, unban, shield mode, or policy sync
export async function POST(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "ban": {
        const { ip, reason, durationMs, port, serverId } = body;
        if (!ip) return NextResponse.json({ error: "IP required" }, { status: 400 });
        const res = banIp(ip, reason || "Manual administrator ban", durationMs || 900000, port, serverId, true);
        return NextResponse.json({ success: res });
      }

      case "unban": {
        const { ip } = body;
        if (!ip) return NextResponse.json({ error: "IP required" }, { status: 400 });
        const res = unbanIp(ip);
        return NextResponse.json({ success: res });
      }

      case "shield_mode": {
        const { enabled } = body;
        setFleetShieldMode(Boolean(enabled));
        return NextResponse.json({ success: true, shieldMode: Boolean(enabled) });
      }

      case "under_attack": {
        const { serverId, enabled, durationMs } = body;
        if (!serverId) return NextResponse.json({ error: "Server ID required" }, { status: 400 });
        setServerUnderAttack(serverId, Boolean(enabled), durationMs || 3600000);
        return NextResponse.json({ success: true, underAttack: Boolean(enabled) });
      }

      case "sync_trusted_ips": {
        const { ips } = body;
        if (Array.isArray(ips)) {
          updateTrustedIps(ips);
        }
        return NextResponse.json({ success: true });
      }

      case "sync_thresholds": {
        const { thresholds } = body;
        if (thresholds && typeof thresholds === "object") {
          updateServerThresholds(thresholds);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
