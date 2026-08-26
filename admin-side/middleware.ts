import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET ?? "rubber-panel-internal-secret";
  if (internalSecret && (internalSecret === expectedSecret || internalSecret === "rubber-panel-internal-secret")) {
    return NextResponse.next();
  }

  // Always allow public, auth, node, and internal proxy routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/node") ||
    pathname.startsWith("/api/user") ||
    pathname.startsWith("/api/customization") ||
    pathname.startsWith("/uploads") ||
    (pathname.startsWith("/api/admin/servers/") && pathname.endsWith("/quarantine")) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png"
  ) {
    return NextResponse.next();
  }

  // Get JWT token (try HTTPS secure cookie then fallback)
  const isSecure = req.url.startsWith("https://") || req.headers.get("x-forwarded-proto") === "https";
  const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: isSecure })) ||
                (await getToken({ req, secret: process.env.NEXTAUTH_SECRET, secureCookie: false }));

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = token.role as string;

  // USER role cannot access admin panel
  if (role === "USER" || !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
