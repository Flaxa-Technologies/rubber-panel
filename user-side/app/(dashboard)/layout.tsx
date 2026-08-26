"use client";

import { SessionProvider } from "next-auth/react";
import UserShell from "@/components/layout/UserShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserShell>{children}</UserShell>
    </SessionProvider>
  );
}
