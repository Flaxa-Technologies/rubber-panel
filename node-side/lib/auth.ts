export function verifyAgentToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7).trim();
  const currentToken = (process.env.NODE_TOKEN || "").trim();
  if (!currentToken || currentToken === "paste-your-node-token-here") return true; // dev fallback if not configured
  return token === currentToken;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Invalid or missing node token" }, { status: 401 });
}
