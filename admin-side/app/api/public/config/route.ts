import { NextRequest, NextResponse } from "next/server";
import { getSettingBool, getSetting } from "@/lib/settings";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Secret, X-User-Id, X-Source, Authorization",
};

export function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/public/config — Public endpoint, no auth required
// Returns settings the user-side needs to configure itself
export async function GET(request: NextRequest) {
  const [registrationEnabled, siteName, siteDescription, accentColor] = await Promise.all([
    getSettingBool("auth.registrationEnabled"),
    getSetting("branding.siteName"),
    getSetting("branding.siteDescription"),
    getSetting("branding.accentColor"),
  ]);

  return NextResponse.json({
    registrationEnabled,
    siteName: siteName ?? "Rubber Panel",
    siteDescription: siteDescription ?? "Professional Minecraft Hosting",
    accentColor: accentColor ?? "#a3e635",
  }, { headers: corsHeaders });
}
