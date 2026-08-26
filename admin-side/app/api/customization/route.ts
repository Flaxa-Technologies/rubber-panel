import { NextResponse } from "next/server";
import { getPublicCustomization } from "@/lib/settings";

// GET /api/customization — Public branding & theme configuration
export async function GET() {
  const customization = await getPublicCustomization();
  return NextResponse.json({ customization });
}
