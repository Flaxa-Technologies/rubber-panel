import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "0d163083c67a02686d6d0186c132c2d4a82efa997cf5759bf23d66096d06d009",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Delegate auth to admin API
        try {
          const res = await fetch(`${ADMIN_API_URL}/api/auth/user/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Secret": INTERNAL_SECRET,
            },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });

          if (!res.ok) return null;
          const user = await res.json();

          return {
            id: user.id,
            email: user.email,
            name: user.username,
            role: user.role,
            username: user.username,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
};
