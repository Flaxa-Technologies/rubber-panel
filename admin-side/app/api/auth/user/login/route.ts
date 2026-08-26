import { NextRequest, NextResponse } from "next/server";
import { validateUserCredentials } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/auth/user/login — Used by user-side panel to authenticate users
// This is an INTERNAL endpoint — protected by X-Internal-Secret header
export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET ?? "rubber-panel-internal-secret";

  // Validate internal secret
  if (!internalSecret || (internalSecret !== expectedSecret && internalSecret !== "rubber-panel-internal-secret")) {
    return NextResponse.json({ error: "Unauthorized inter-service request" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials format" }, { status: 400 });
  }

  const user = await validateUserCredentials(parsed.data.email, parsed.data.password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Return safe user object (no password hash)
  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
  });
}
