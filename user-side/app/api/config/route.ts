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

  if (data && typeof data.registrationEnabled === "boolean") {
    return NextResponse.json(
      {
        registrationEnabled: data.registrationEnabled === true,
        siteName: data.siteName || "Rubber Panel",
        siteDescription: data.siteDescription || "Professional Minecraft Hosting",
        accentColor: data.accentColor || "#a3e635",
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

  // Safe fallback: registration is closed unless explicit confirmation from admin-side
  return NextResponse.json(
    {
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
