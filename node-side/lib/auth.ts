import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// In-memory cache for tokens verified by Admin Panel
const verifiedTokensCache = new Set<string>();

export function stripQuotes(str: string): string {
  let s = (str || "").trim();
  while ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function getLocalNodeTokens(): Set<string> {
  const set = new Set<string>();

  const add = (raw: string | undefined) => {
    if (!raw) return;
    const clean = stripQuotes(raw);
    if (clean && clean !== "paste-your-node-token-here" && clean !== "dev-token-placeholder") {
      set.add(clean);
    }
  };

  add(process.env.NODE_TOKEN);
  add(process.env.AGENT_TOKEN);
  add(process.env.NODE_AUTH_TOKEN);

  // Add all tokens already verified by admin panel
  for (const t of verifiedTokensCache) {
    set.add(t);
  }

  const envCandidates = [
    "/var/rubber-panel/node-daemon/.env",
    path.join(process.cwd(), ".env"),
  ];

  for (const envFile of envCandidates) {
    if (fs.existsSync(envFile)) {
      try {
        const content = fs.readFileSync(envFile, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim();
          if (k === "NODE_TOKEN" || k === "AGENT_TOKEN" || k === "NODE_AUTH_TOKEN") {
            add(v);
          }
        }
      } catch {}
    }
  }

  return set;
}

function syncTokenToEnvFile(token: string) {
  try {
    process.env.NODE_TOKEN = token;
    const envCandidates = [
      "/var/rubber-panel/node-daemon/.env",
      path.join(process.cwd(), ".env"),
    ];
    for (const envFile of envCandidates) {
      if (fs.existsSync(envFile)) {
        let content = fs.readFileSync(envFile, "utf-8");
        if (content.includes("NODE_TOKEN=")) {
          content = content.replace(/NODE_TOKEN=.*/g, `NODE_TOKEN="${token}"`);
        } else {
          content += `\nNODE_TOKEN="${token}"\n`;
        }
        fs.writeFileSync(envFile, content, "utf-8");
        break;
      }
    }
  } catch (err) {
    console.warn("[AgentAuth] Could not persist verified token to .env:", err);
  }
}

export function extractBearerToken(request: NextRequest): string {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return stripQuotes(authHeader.substring(7));
  }
  const xToken = request.headers.get("x-node-token") || request.headers.get("x-agent-token");
  if (xToken) {
    return stripQuotes(xToken);
  }
  return "";
}

/** Synchronous verification against local environment & disk .env files */
export function verifyAgentToken(request: NextRequest): boolean {
  const token = extractBearerToken(request);
  if (!token) {
    console.warn(`[AgentAuth] ⚠️ Missing Authorization header for ${request.method} ${request.nextUrl.pathname}`);
    return false;
  }

  const validTokens = getLocalNodeTokens();

  // If node is unconfigured, allow local dev
  if (validTokens.size === 0) {
    return true;
  }

  const matches = validTokens.has(token);
  if (!matches) {
    const receivedSnippet = token.length > 8 ? `${token.slice(0, 8)}... (len ${token.length})` : `"${token}"`;
    const expectedSnippets = Array.from(validTokens).map(t => `${t.slice(0, 8)}... (len ${t.length})`).join(", ");
    console.warn(`[AgentAuth] ⚠️ Token mismatch for ${request.method} ${request.nextUrl.pathname}! Received: ${receivedSnippet}, Configured: [${expectedSnippets}]`);
  }

  return matches;
}

/** Asynchronous verification with Admin Panel self-healing fallback */
export async function verifyAgentTokenAsync(request: NextRequest): Promise<boolean> {
  // 1. Try instant sync check
  if (verifyAgentToken(request)) {
    return true;
  }

  const token = extractBearerToken(request);
  if (!token) return false;

  // 2. If sync check failed, check with configured Admin Panel
  let adminUrl = (process.env.ADMIN_API_URL || "").trim().replace(/\/$/, "");
  if (!adminUrl) {
    try {
      const envPath = fs.existsSync("/var/rubber-panel/node-daemon/.env")
        ? "/var/rubber-panel/node-daemon/.env"
        : path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, "utf-8");
        for (const line of raw.split("\n")) {
          if (line.startsWith("ADMIN_API_URL=")) {
            adminUrl = stripQuotes(line.slice("ADMIN_API_URL=".length)).replace(/\/$/, "");
            break;
          }
        }
      }
    } catch {}
  }

  if (!adminUrl) {
    return false;
  }

  try {
    console.log(`[AgentAuth] Local token mismatch for ${request.nextUrl.pathname}. Validating token against Admin Panel (${adminUrl})...`);
    const res = await fetch(`${adminUrl}/api/node/heartbeat`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "RubberNode-AgentAuth/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      console.log(`[AgentAuth] ✓ Admin Panel verified token! Auto-healing local node token...`);
      verifiedTokensCache.add(token);
      syncTokenToEnvFile(token);
      return true;
    } else {
      console.warn(`[AgentAuth] ⚠️ Admin Panel rejected token with HTTP ${res.status}`);
    }
  } catch (err: any) {
    console.warn(`[AgentAuth] ⚠️ Could not contact Admin Panel to verify token:`, err?.message);
  }

  return false;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
