import { NextResponse } from "next/server";
import { adminApiFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/config — Local proxy for public config so browser doesn't need to hit port 3000 (avoids CORS)
export async function GET() {
  const { data } = await adminApiFetch<{
    registrationEnabled: boolean;
    siteName: string;
    siteDescription: string;
    accentColor: string;
  }>("/api/public/config");

  return NextResponse.json(
    data ?? {
      registrationEnabled: true,
      siteName: "Rubber Panel",
      siteDescription: "Professional Minecraft Hosting",
      accentColor: "#a3e635",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
