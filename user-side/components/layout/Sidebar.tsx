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
  HardDrive, 
  ExternalLink,
  X,
  Globe,
  Sparkles,
  Activity,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useCustomization } from "./CustomizationContext";

function DiscordIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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

const navSections = [
  {
    title: "COMPUTE & CLOUD",
    items: [
      { href: "/dashboard", label: "Instances", icon: Server, badge: "Live" },
      { href: "/subdomains", label: "Custom Domains", icon: Globe },
      { href: "/resources", label: "Resource Pool", icon: Sparkles, badge: "Quota" },
    ],
  },
  {
    title: "NETWORK & HEALTH",
    items: [
      { href: "/status", label: "Status & Nodes", icon: Activity, dot: true },
    ],
  },
  {
    title: "PREFERENCES",
    items: [
      { href: "/account", label: "Account Profile", icon: User },
    ],
  },
];

const adminNav = [
  { href: "http://localhost:3000/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "http://localhost:3000/servers", label: "Instances", icon: Server },
  { href: "http://localhost:3000/allocations", label: "Ports", icon: HardDrive },
  { href: "http://localhost:3000/customization", label: "Customization", icon: Settings },
];

export default function Sidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const displayName = user?.username ?? user?.name ?? "User";
  const userEmail = user?.email ?? "Cloud Account";

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

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/" || pathname.startsWith("/servers");
    }
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <aside className="saas-sidebar" style={{ width: 220, borderRight: "1px solid var(--border-subtle)", background: "linear-gradient(180deg, #090a0f 0%, #050608 100%)" }}>
      {/* Brand Header */}
      <div style={{ padding: "16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }} suppressHydrationWarning>
          <div style={{ position: "relative", width: 28, height: 28, borderRadius: 8, background: "rgba(163, 230, 53, 0.1)", border: "1px solid rgba(163, 230, 53, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            <Image 
              src={logoUrl || "/logo.png"} 
              alt="Logo" 
              width={20} 
              height={20} 
              style={{ objectFit: "contain" }} 
              unoptimized 
              suppressHydrationWarning
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: "#ffffff", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} suppressHydrationWarning>
              {siteName || "Rubber Panel"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>Client Portal</span>
            </div>
          </div>
        </Link>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="md:hidden" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Main Categorized Navigation */}
      <div style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
        {navSections.map((section) => (
          <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", padding: "2px 8px 4px" }}>
              {section.title}
            </div>
            {section.items.map(({ href, label, icon: Icon, badge, dot }: any) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onCloseMobile}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? "#ffffff" : "var(--text-secondary)",
                    backgroundColor: active ? "rgba(255, 255, 255, 0.07)" : "transparent",
                    border: active ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid transparent",
                    boxShadow: active ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
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
                  {/* Active Indicator Bar */}
                  {active && (
                    <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: "0 4px 4px 0", background: "var(--status-online, #10b981)" }} />
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Icon size={15} style={{ color: active ? "#38bdf8" : "var(--text-muted)", flexShrink: 0, transition: "color 0.15s" }} />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                  </div>

                  {/* Badge or Pulse Dot */}
                  {badge && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: active ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.06)", color: active ? "#38bdf8" : "var(--text-dim)", border: `1px solid ${active ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.08)"}` }}>
                      {badge}
                    </span>
                  )}
                  {dot && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 6, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", padding: "2px 8px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>ADMIN PANEL</span>
              <span style={{ fontSize: 8.5, padding: "1px 4px", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 4, color: "#f59e0b", fontWeight: 700 }}>ROOT</span>
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
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Icon size={14} style={{ color: "var(--text-dim)" }} />
                  <span>{label}</span>
                </div>
                <ExternalLink size={10} style={{ opacity: 0.4 }} />
              </a>
            ))}
          </div>
        )}

        {/* Custom Community Links */}
        {customLinks && customLinks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 6, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", padding: "2px 8px 4px" }}>
              COMMUNITY
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
                  padding: "7px 10px",
                  borderRadius: 8,
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
      </div>

      {/* Social Community Bar */}
      {(discord || youtube || instagram || twitter || website) && (
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(0, 0, 0, 0.2)" }}>
          {discord && (
            <a href={discord} target="_blank" rel="noreferrer" title="Join Discord" style={{ padding: 5, borderRadius: 6, color: "var(--text-muted)", transition: "all 0.15s" }} className="hover:text-indigo-400 hover:bg-white/[0.05]">
              <DiscordIcon size={14} />
            </a>
          )}
          {youtube && (
            <a href={youtube} target="_blank" rel="noreferrer" title="YouTube" style={{ padding: 5, borderRadius: 6, color: "var(--text-muted)", transition: "all 0.15s" }} className="hover:text-red-400 hover:bg-white/[0.05]">
              <YoutubeIcon size={14} />
            </a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noreferrer" title="Instagram" style={{ padding: 5, borderRadius: 6, color: "var(--text-muted)", transition: "all 0.15s" }} className="hover:text-pink-400 hover:bg-white/[0.05]">
              <InstagramIcon size={14} />
            </a>
          )}
          {twitter && (
            <a href={twitter} target="_blank" rel="noreferrer" title="Twitter / X" style={{ padding: 5, borderRadius: 6, color: "var(--text-muted)", transition: "all 0.15s" }} className="hover:text-sky-400 hover:bg-white/[0.05]">
              <TwitterIcon size={14} />
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer" title="Official Website" style={{ padding: 5, borderRadius: 6, color: "var(--text-muted)", transition: "all 0.15s" }} className="hover:text-emerald-400 hover:bg-white/[0.05]">
              <Globe size={14} />
            </a>
          )}
        </div>
      )}

      {/* User Footer Profile Card */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: "0 0 10px rgba(124, 58, 237, 0.3)" }}>
            {displayName[0]?.toUpperCase() ?? "U"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#ffffff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {isAdmin ? "Administrator" : "Member"}
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
          style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "var(--text-muted)", cursor: "pointer", padding: "5px 7px", borderRadius: 6, transition: "all 0.15s" }}
          title="Sign out"
          className="hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
        >
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  );
}
