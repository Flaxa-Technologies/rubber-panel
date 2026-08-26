import { NextResponse } from "next/server";
import { adminApiFetch } from "@/lib/api-client";

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
      registrationEnabled: false,
      siteName: "Rubber Panel",
      siteDescription: "Professional Minecraft Hosting",
      accentColor: "#a3e635",
    }
  );
}
