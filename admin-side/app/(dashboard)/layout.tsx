"use client";

import { SessionProvider } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 ml-60 flex flex-col min-h-screen">
          <TopBar />
          <main
            className="flex-1 p-6 mt-16 animate-fade-in"
            style={{ backgroundColor: "var(--color-rp-bg)" }}
          >
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
