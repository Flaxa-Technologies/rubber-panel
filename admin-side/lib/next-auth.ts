import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { validateAdminUser } from "./auth";
import { createAuditLog } from "./audit";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "0b45213798555e20685623b6e1949329d995b48790c0862980c3eb8b8bbda7ea",
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

        const user = await validateAdminUser(credentials.email, credentials.password);

        if (!user) {
          await createAuditLog({
            actorEmail: credentials.email,
            action: "USER_LOGIN_FAILED",
            result: "FAILED",
            metadata: { email: credentials.email },
          }).catch(() => {});
          return null;
        }

        await createAuditLog({
          actorId: user.id,
          actorEmail: user.email,
          action: "USER_LOGIN",
          target: "admin-panel",
          metadata: { role: user.role },
        }).catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
          username: user.username,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.username = token.username;
      }
      return session;
    },
  },
};
