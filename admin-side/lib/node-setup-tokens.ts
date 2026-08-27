import crypto from "crypto";

export interface SetupTokenData {
  nodeId: string;
  authToken: string;
  port: number;
  expiresAt: number; // ms timestamp
}

// In-memory cache for fast lookup
const tokenCache = new Map<string, SetupTokenData>();

// Secret key for HMAC token signing
const SETUP_SECRET = process.env.INTERNAL_API_SECRET ?? process.env.NEXTAUTH_SECRET ?? "rubber-panel-node-setup-secret";

export function createSetupToken(data: { nodeId: string; authToken: string; port?: number; ttlMinutes?: number }): string {
  const ttl = (data.ttlMinutes ?? 15) * 60 * 1000;
  const expiresAt = Date.now() + ttl;
  
  const payload = JSON.stringify({
    nodeId: data.nodeId,
    authToken: data.authToken,
    port: data.port || 3001,
    exp: expiresAt,
  });

  const base64Payload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", SETUP_SECRET).update(base64Payload).digest("base64url");
  
  const token = `ncfg_${base64Payload}.${signature}`;

  tokenCache.set(token, {
    nodeId: data.nodeId,
    authToken: data.authToken,
    port: data.port || 3001,
    expiresAt,
  });

  return token;
}

export function verifySetupToken(token: string): SetupTokenData | null {
  // Strip any trailing .sh or prefix
  let cleanToken = token.trim();
  if (cleanToken.endsWith(".sh")) {
    cleanToken = cleanToken.slice(0, -3);
  }

  // 1. Check in-memory cache
  const cached = tokenCache.get(cleanToken);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      tokenCache.delete(cleanToken);
      return null;
    }
    return cached;
  }

  // 2. Cryptographic HMAC validation fallback
  if (!cleanToken.startsWith("ncfg_")) return null;
  const raw = cleanToken.slice(5);
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const base64Payload = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);

  const expectedSig = crypto.createHmac("sha256", SETUP_SECRET).update(base64Payload).digest("base64url");
  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return {
      nodeId: payload.nodeId,
      authToken: payload.authToken,
      port: payload.port || 3001,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}
