import bcrypt from "bcryptjs";
import db from "./db";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function validateAdminUser(identifier: string, password: string) {
  const clean = identifier.trim();
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: clean.toLowerCase() },
        { email: clean },
        { username: clean.toLowerCase() },
        { username: clean },
      ],
    },
  });

  if (!user) return null;
  if (user.status === "SUSPENDED") return null;
  if (user.role === "USER") return null; // USER role can't access admin panel

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) return null;

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

export async function validateUserCredentials(identifier: string, password: string) {
  const clean = identifier.trim();
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: clean.toLowerCase() },
        { email: clean },
        { username: clean.toLowerCase() },
        { username: clean },
      ],
    },
  });

  if (!user) return null;
  if (user.status === "SUSPENDED") return null;

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) return null;

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return user;
}

export async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const { randomBytes } = await import("crypto");
  const key = `rp_${randomBytes(32).toString("hex")}`;
  const prefix = key.substring(0, 10);
  const hash = await bcrypt.hash(key, SALT_ROUNDS);
  return { key, prefix, hash };
}

export async function generateNodeToken(): Promise<string> {
  const { randomBytes } = await import("crypto");
  return `rp_node_${randomBytes(32).toString("hex")}`;
}
