"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, ArrowUpCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/servers": "Servers",
  "/servers/create": "Create Server",
  "/nodes": "Nodes",
  "/allocations": "Allocations",
  "/software": "Software",
  "/templates": "Templates",
  "/backups": "Backups",
  "/settings": "Settings",
  "/api-keys": "API Keys",
  "/audit-logs": "Audit Logs",
  "/updates": "Update Manager",
  "/status-page": "Status Page",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [key, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(key + "/")) return title;
  }
  return "Rubber Panel";
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const title = getPageTitle(pathname);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/admin/updates");
        if (res.ok) {
          const data = await res.json();
          if (data.available) setUpdateVersion(data.latestVersion);
          else setUpdateVersion(null);
        }
      } catch {}
    }
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="h-16 border-b flex items-center justify-between px-6 fixed top-0 right-0 left-60 z-20"
      style={{
        backgroundColor: "var(--color-rp-surface)",
        borderColor: "var(--color-rp-border)",
      }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-rp-text)" }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Update notification banner */}
        {updateVersion && pathname !== "/updates" && (
          <button
            onClick={() => router.push("/updates")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "#f59e0b",
            }}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            Update available — {updateVersion}
          </button>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
          style={{
            backgroundColor: "var(--color-rp-surface-2)",
            borderColor: "var(--color-rp-border)",
            color: "var(--color-rp-text-muted)",
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Search...</span>
          <kbd
            className="ml-4 text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "var(--color-rp-border)",
              color: "var(--color-rp-text-dim)",
            }}
          >
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button
          className="p-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: "var(--color-rp-surface-2)",
            borderColor: "var(--color-rp-border)",
          }}
        >
          <Bell className="w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
        </button>

        {/* Status badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium"
          style={{
            backgroundColor: "rgba(34,197,94,0.08)",
            borderColor: "rgba(34,197,94,0.2)",
            color: "var(--color-rp-green)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 status-dot-online" />
          All systems operational
        </div>
      </div>
    </header>
  );
}
