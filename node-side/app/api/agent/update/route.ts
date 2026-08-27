import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, unauthorizedResponse } from "@/lib/auth";
import { runNodeUpdate } from "@/lib/node-updater";

export async function POST(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { assetUrl, version } = body;

    if (!assetUrl || !version) {
      return NextResponse.json({ error: "Missing assetUrl or version" }, { status: 400 });
    }

    const result = await runNodeUpdate(version, assetUrl);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to initiate update" }, { status: 500 });
  }
}
