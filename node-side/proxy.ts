import { NextRequest, NextResponse } from "next/server";
import { recordIncomingTraffic, isIpBanned } from "@/lib/radar-engine";

export async function proxy(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "127.0.0.1";

  // Check if IP is actively banned by Radar
  if (isIpBanned(ip)) {
    return new NextResponse(
      JSON.stringify({
        error: "ACCESS_DENIED_RADAR_MITIGATION",
        message: "Your IP has been quarantined by Rubber Radar defense engine for high-frequency flood.",
        ip,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Radar-Action": "BLOCKED",
        },
      }
    );
  }

  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  const estBytesIn = Math.max(contentLength, 350); // Header + body estimate
  const estBytesOut = 450; // Response estimate

  recordIncomingTraffic(estBytesIn, estBytesOut, ip, 3001);

  return NextResponse.next();
}
