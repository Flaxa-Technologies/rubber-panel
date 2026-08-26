import { NextRequest, NextResponse } from "next/server";

const NODE_TOKEN = process.env.NODE_TOKEN;

export function verifyAgentToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7);
  return token === NODE_TOKEN;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid or missing node token" }, { status: 401 });
}
