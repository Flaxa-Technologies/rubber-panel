import { NextRequest, NextResponse } from "next/server";
import { adminApiFetch } from "@/lib/api-client";

export const dynamic = "force-dynamic";

// POST /api/auth/register — User self-registration
export async function POST(request: NextRequest) {
  // 1. Explicit check if registration is enabled via public config
  const { data: config } = await adminApiFetch<{ registrationEnabled: boolean }>("/api/public/config");
  if (!config || config.registrationEnabled !== true) {
    return NextResponse.json(
      { error: "New user registration is currently disabled by administrator." },
      { status: 403 }
    );
  }

  const body = await request.json();

  const { data, error, status } = await adminApiFetch<{
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
  }>("/api/auth/user/register", {
    method: "POST",
    body,
  });

  if (error) {
    return NextResponse.json({ error }, { status: status || 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
