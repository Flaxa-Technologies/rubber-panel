import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // Allow public and auth routes
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/status") ||
      pathname.startsWith("/api/status") ||
      pathname.startsWith("/api/public") ||
      pathname.startsWith("/api/user/customization") ||
      pathname.startsWith("/uploads") ||
      pathname.startsWith("/api/auth")
    ) {
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET || "0d163083c67a02686d6d0186c132c2d4a82efa997cf5759bf23d66096d06d009",
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        // Public routes don't require auth
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/status") ||
          pathname.startsWith("/api/status") ||
          pathname.startsWith("/api/public") ||
          pathname.startsWith("/api/user/customization") ||
          pathname.startsWith("/uploads") ||
          pathname.startsWith("/api/auth")
        ) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
