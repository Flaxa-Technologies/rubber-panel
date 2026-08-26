import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminApiFetch } from "@/lib/api-client";

// POST /api/auth/register — User self-registration
// Checks registrationEnabled server-side AND admin API enforces it
export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data, { status: 201 });
}
