import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getSettingBool } from "@/lib/settings";
import db from "@/lib/db";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /api/auth/user/register — User-initiated registration
// Enforces registrationEnabled setting server-side
export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── CRITICAL: Check registration setting BEFORE doing anything else ──────
  const registrationEnabled = await getSettingBool("auth.registrationEnabled");
  if (!registrationEnabled) {
    return NextResponse.json(
      { error: "New user registration is currently disabled." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { username, email, password } = parsed.data;

  // Check uniqueness
  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return NextResponse.json({ error: "Email or username already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: "USER",
      status: "ACTIVE",
    },
    select: {
      id: true, username: true, email: true, role: true, status: true, createdAt: true,
    },
  });

  await createAuditLog({
    action: "USER_CREATED",
    target: user.email,
    targetId: user.id,
    ipAddress: getIpFromRequest(request),
    metadata: { username, email, source: "self-registration" },
  });

  return NextResponse.json(user, { status: 201 });
}
