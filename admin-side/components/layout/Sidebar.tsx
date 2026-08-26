"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  Server,
  MonitorSpeaker,
  Network,
  Package,
  FileCode2,
  Archive,
  Settings,
  Key,
  ScrollText,
  ChevronRight,
  LogOut,
  Palette,
  Sparkles,
  Zap,
  Box,
  Activity,
  Download,
} from "lucide-react";


import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/resources", label: "Resource Quotas", icon: Sparkles },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/cryo-sleep", label: "Cryo-Sleep", icon: Zap },
  { href: "/nodes", label: "Nodes", icon: MonitorSpeaker },
  { href: "/allocations", label: "Port Management", icon: Network },
  { href: "/images", label: "Container Images", icon: Box },
  { href: "/software", label: "Software", icon: Package },
  { href: "/templates", label: "Templates", icon: FileCode2 },
  { href: "/backups", label: "Backups", icon: Archive },
];

const systemItems = [
  { href: "/status-page", label: "Status Page", icon: Activity },
  { href: "/customization", label: "Customization", icon: Palette },
  { href: "/updates", label: "Updates", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [branding, setBranding] = useState<{ siteName: string; logoUrl: string }>({
    siteName: "Rubber Panel",
    logoUrl: "/logo.png",
  });
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Check for updates every 15 minutes
    async function checkUpdates() {
      try {
        const res = await fetch("/api/admin/updates");
        if (res.ok) {
          const data = await res.json();
          setHasUpdate(data.available === true);
        }
      } catch {}
    }
    checkUpdates();
    const updateInterval = setInterval(checkUpdates, 15 * 60 * 1000);
    return () => clearInterval(updateInterval);
  }, []);

  useEffect(() => {
    function load() {
      fetch("/api/customization")
        .then(r => r.json())
        .then(d => {
          if (d.customization) {
            setBranding({
              siteName: d.customization["branding.siteName"] || "Rubber Panel",
              logoUrl: d.customization["branding.logoUrl"] || "/logo.png",
            });
          }
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="flex flex-col h-screen w-60 border-r fixed left-0 top-0 z-30"
      style={{
        backgroundColor: "var(--color-rp-surface)",
        borderColor: "var(--color-rp-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 py-5 border-b"
        style={{ borderColor: "var(--color-rp-border)" }}
      >
        <Image src={branding.logoUrl || "/logo.png"} alt="Rubber Panel" width={32} height={32} style={{ borderRadius: "6px" }} unoptimized={true} suppressHydrationWarning />
        <div suppressHydrationWarning>
          <div className="font-semibold text-sm leading-none" style={{ color: "var(--color-rp-text)" }} suppressHydrationWarning>
            Rubber Panel
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
            by Flaxa Studios
          </div>
        </div>
      </div>


      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="mb-1">
          <p className="px-2 mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>
            Management
          </p>
          {navItems.map((item) => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="mt-4">
          <p className="px-2 mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>
            System
          </p>
          {systemItems.map((item) => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} badge={item.href === "/updates" && hasUpdate ? "update" : undefined} />
          ))}
        </div>
      </nav>

      {/* User */}
      <div
        className="p-3 border-t"
        style={{ borderColor: "var(--color-rp-border)" }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ backgroundColor: "var(--color-rp-surface-2)" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" }}
          >
            {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: "var(--color-rp-text)" }}>
              {session?.user?.name ?? "Admin"}
            </div>
            <div className="text-xs truncate" style={{ color: "var(--color-rp-text-muted)" }}>
              {(session?.user as any)?.role ?? "ADMIN"}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded-md transition-colors hover:bg-red-500/10"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: "update";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group mb-0.5"
      style={
        active
          ? {
              backgroundColor: "var(--color-rp-accent-glow)",
              color: "var(--color-rp-accent)",
            }
          : {
              color: "var(--color-rp-text-muted)",
            }
      }
    >
      <Icon
        className="w-4 h-4 flex-shrink-0 transition-colors"
        style={active ? { color: "var(--color-rp-accent)" } : {}}
      />
      <span className="flex-1">{label}</span>
      {badge === "update" && !active && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#f59e0b" }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#f59e0b" }} />
        </span>
      )}
      {active && (
        <ChevronRight className="w-3 h-3" style={{ color: "var(--color-rp-accent)" }} />
      )}
    </Link>
  );
}
