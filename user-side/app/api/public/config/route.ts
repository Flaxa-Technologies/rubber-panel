import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";

// GET /api/public/config — Proxies public config from admin API (no auth required)
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${ADMIN_API_URL}/api/public/config`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Fallback: safe defaults if admin API is unreachable
    return NextResponse.json({
      registrationEnabled: false,
      siteName: "Rubber Panel",
      siteDescription: "Professional Minecraft Hosting",
      accentColor: "#a3e635",
    });
  }
}
