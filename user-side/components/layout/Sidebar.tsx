"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  Server, 
  User, 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  Users, 
  HardDrive, 
  Box, 
  ExternalLink,
  X,
  Globe,
  MessageCircle,
  Sparkles,
  Activity,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useCustomization } from "./CustomizationContext";

function YoutubeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

function TwitterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

const mainNav = [
  { href: "/dashboard", label: "Instances", icon: Server },
  { href: "/resources", label: "Resource Pool", icon: Sparkles },
  { href: "/status", label: "Status Page", icon: Activity },
  { href: "/account", label: "Account", icon: User },
];

const adminNav = [
  { href: "http://localhost:3000/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "http://localhost:3000/servers", label: "Instances", icon: Server },
  { href: "http://localhost:3000/allocations", label: "Ports", icon: HardDrive },
  { href: "http://localhost:3000/customization", label: "Customization", icon: Settings },
];

function DiscordIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function Sidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";
  const displayName = user?.username ?? user?.name ?? "User";

  const { 
    siteName, 
    logoUrl, 
    discord, 
    youtube, 
    instagram, 
    twitter, 
    website, 
    customLinks 
  } = useCustomization();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside className="saas-sidebar">
      {/* Brand Header */}
      <div style={{ padding: "14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} suppressHydrationWarning>
          <Image 
            src={logoUrl || "/logo.png"} 
            alt="Logo" 
            width={22} 
            height={22} 
            style={{ borderRadius: 6 }} 
            unoptimized 
            suppressHydrationWarning
          />
          <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-pure)", letterSpacing: "-0.02em" }} suppressHydrationWarning>
            {siteName || "Rubber Panel"}
          </span>
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="md:hidden" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)", padding: "4px 8px 6px" }}>
          Platform
        </div>
        {mainNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "7px 9px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? "#ffffff" : "var(--text-secondary)",
                backgroundColor: active ? "var(--bg-surface-elevated)" : "transparent",
                border: active ? "1px solid var(--border-medium)" : "1px solid transparent",
                transition: "all 0.1s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon size={15} style={{ opacity: active ? 1 : 0.7 }} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)", padding: "4px 8px 6px", display: "flex", justifyContent: "space-between" }}>
            <span>Admin</span>
            <span style={{ fontSize: 9, padding: "1px 4px", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 4, color: "var(--text-muted)" }}>SYSTEM</span>
          </div>
          {adminNav.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 9px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-secondary)",
                transition: "all 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={14} style={{ opacity: 0.7 }} />
                <span>{label}</span>
              </div>
              <ExternalLink size={10} style={{ opacity: 0.3 }} />
            </a>
          ))}
        </div>
      )}

      {/* Custom Community Links if any */}
      {customLinks && customLinks.length > 0 && (
        <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)", padding: "4px 8px 6px" }}>
            Links
          </div>
          {customLinks.map((cl) => (
            <a
              key={cl.id}
              href={cl.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 9px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
              className="hover:text-white hover:bg-white/[0.04]"
            >
              <span>{cl.label}</span>
              <ExternalLink size={10} style={{ opacity: 0.4 }} />
            </a>
          ))}
        </div>
      )}

      {/* Social Icons Row */}
      {(discord || youtube || instagram || twitter || website) && (
        <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-subtle)" }}>
          {discord && (
            <a href={discord} target="_blank" rel="noreferrer" title="Join Discord" className="text-zinc-500 hover:text-indigo-400 p-1">
              <DiscordIcon size={14} />
            </a>
          )}
          {youtube && (
            <a href={youtube} target="_blank" rel="noreferrer" title="YouTube" className="text-zinc-500 hover:text-red-400 p-1">
              <YoutubeIcon size={14} />
            </a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noreferrer" title="Instagram" className="text-zinc-500 hover:text-pink-400 p-1">
              <InstagramIcon size={14} />
            </a>
          )}
          {twitter && (
            <a href={twitter} target="_blank" rel="noreferrer" title="Twitter / X" className="text-zinc-500 hover:text-sky-400 p-1">
              <TwitterIcon size={14} />
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer" title="Official Website" className="text-zinc-500 hover:text-emerald-400 p-1">
              <Globe size={14} />
            </a>
          )}
        </div>
      )}

      {/* User Footer */}
      <div style={{ marginTop: "auto", padding: "10px 12px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#27272a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, flexShrink: 0 }}>
            {displayName[0]?.toUpperCase() ?? "U"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {displayName}
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            try {
              await signOut({ redirect: false });
            } catch {}
            window.location.href = "/login";
          }}
          style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4 }}
          title="Sign out"
          className="hover:text-white"
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
