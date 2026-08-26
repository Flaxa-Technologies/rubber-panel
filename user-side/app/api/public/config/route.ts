import { NextRequest, NextResponse } from "next/server";
import { adminApiFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/public/config — Proxies public config from admin API (no auth required)
export async function GET(request: NextRequest) {
  const { data } = await adminApiFetch<{
    registrationEnabled: boolean;
    siteName: string;
    siteDescription: string;
    accentColor: string;
  }>("/api/public/config");

  return NextResponse.json(
    data ?? {
      registrationEnabled: false,
      siteName: "Rubber Panel",
      siteDescription: "Professional Minecraft Hosting",
      accentColor: "#a3e635",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
