import { NextResponse } from "next/server";
import { adminApiFetch } from "@/lib/api-client";

// GET /api/user/customization
export async function GET() {
  const { data, error, status } = await adminApiFetch<{ customization: Record<string, string> }>("/api/customization");
  if (error || !data) {
    return NextResponse.json({
      customization: {
        "branding.siteName": "Rubber Panel",
        "branding.logoUrl": "/logo.png",
        "branding.footerText": "Powered by Rubber Panel",
        "branding.themePreset": "onyx",
        "branding.accentColor": "#ffffff",
        "social.discord": "https://discord.gg/rubberpanel",
        "features.showDiscordButton": "true",
        "features.suspendedDiscordCta": "true",
      }
    });
  }
  return NextResponse.json(data);
}
