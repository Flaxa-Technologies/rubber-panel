"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Toggle } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Save,
  Shield,
  Server,
  MonitorSpeaker,
  Palette,
  Lock,
  Check,
  Zap,
  Sliders,
  Sparkles,
  ExternalLink,
  Search,
  Activity,
  KeyRound,
  Users,
} from "lucide-react";

interface SettingsData {
  [key: string]: string;
}

function SettingsSection({
  title,
  description,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border transition-all overflow-hidden flex flex-col"
      style={{
        backgroundColor: "var(--color-rp-surface)",
        borderColor: "var(--color-rp-border)",
      }}
    >
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: "rgba(163, 230, 53, 0.12)",
              border: "1px solid rgba(163, 230, 53, 0.25)",
            }}
          >
            <Icon className="w-4 h-4 text-lime-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>
              {title}
            </h3>
            {description && (
              <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                {description}
              </p>
            )}
          </div>
        </div>
        {badge && (
          <span
            className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: "rgba(163, 230, 53, 0.1)",
              border: "1px solid rgba(163, 230, 53, 0.25)",
              color: "#a3e635",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="p-6 space-y-5 flex-1">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "auth" | "security" | "servers" | "nodes" | "cryosleep">("all");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings?_t=" + Date.now(), { cache: "no-store" });
      const d = await res.json();
      setSettings(d.settings ?? {});
    } catch {
      setError("Failed to load settings from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function update(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function toggleBool(key: string) {
    setSettings((s) => ({ ...s, [key]: s[key] === "true" ? "false" : "true" }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3500);
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to save settings.");
      }
    } catch (err: any) {
      setError(err.message || "Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S / Cmd+S save hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings]);

  const s = settings;
  const bool = (k: string) => s[k] === "true";

  if (loading) {
    return (
      <div className="space-y-6 w-full">
        <div className="h-14 skeleton rounded-2xl w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 skeleton rounded-2xl w-full" />
          ))}
        </div>
      </div>
    );
  }

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showAuth = (activeTab === "all" || activeTab === "auth") && matchesSearch("auth registration email session login");
  const showSecurity = (activeTab === "all" || activeTab === "security") && matchesSearch("security password rate limit lock");
  const showServers = (activeTab === "all" || activeTab === "servers") && matchesSearch("server ram cpu disk backup defaults");
  const showNodes = (activeTab === "all" || activeTab === "nodes") && matchesSearch("node heartbeat timeout agent");
  const showCryo = (activeTab === "all" || activeTab === "cryosleep") && matchesSearch("cryosleep hibernation motd wake proxy idle");

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner & Action Controls */}
      <div
        className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              System &amp; Core Settings
            </h1>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: "rgba(163, 230, 53, 0.12)",
                color: "#a3e635",
                border: "1px solid rgba(163, 230, 53, 0.25)",
              }}
            >
              Live Config
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Configure global authentication policies, security throttles, resource allocations, and Cryo-Sleep automation.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {saved && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                backgroundColor: "rgba(163, 230, 53, 0.12)",
                border: "1px solid rgba(163, 230, 53, 0.3)",
                color: "#a3e635",
              }}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Saved Successfully</span>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-400 bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/25">
              {error}
            </p>
          )}

          <Button
            icon={Save}
            loading={saving}
            onClick={save}
            className="shadow-lg shadow-lime-500/20 font-semibold"
          >
            Save Changes (Ctrl+S)
          </Button>
        </div>
      </div>

      {/* Navigation Filter Tabs & Search Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-xl border overflow-x-auto" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          {[
            { id: "all", label: "All Settings", icon: Sliders },
            { id: "auth", label: "Authentication", icon: Users },
            { id: "security", label: "Security", icon: Lock },
            { id: "servers", label: "Resource Defaults", icon: Server },
            { id: "nodes", label: "Node Fleet", icon: MonitorSpeaker },
            { id: "cryosleep", label: "Cryo-Sleep", icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive ? "bg-lime-400/15 text-lime-400 border border-lime-400/30" : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border outline-none transition-all"
            style={{
              backgroundColor: "var(--color-rp-surface)",
              borderColor: "var(--color-rp-border)",
              color: "var(--color-rp-text)",
            }}
          />
        </div>
      </div>

      {/* Main Full-Width Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Left Column: Authentication & Security */}
        <div className="space-y-6">
          {/* Authentication & User Registration */}
          {showAuth && (
            <SettingsSection
              title="Authentication & User Registration"
              description="Manage public user onboarding and session durations"
              icon={Shield}
              badge={bool("auth.registrationEnabled") ? "Registration Open" : "Registration Closed"}
            >
              {/* Allow New User Registration */}
              <div className="p-4 rounded-xl border flex items-start justify-between gap-4" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                      Allow New User Registration
                    </p>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        bool("auth.registrationEnabled")
                          ? "bg-lime-400/15 text-lime-400 border border-lime-400/30"
                          : "bg-red-400/15 text-red-400 border border-red-400/30"
                      }`}
                    >
                      {bool("auth.registrationEnabled") ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
                    When disabled, the user portal displays a clean &ldquo;Registration Closed&rdquo; screen and only administrators can create new accounts.
                  </p>
                </div>
                <Toggle
                  checked={bool("auth.registrationEnabled")}
                  onChange={() => toggleBool("auth.registrationEnabled")}
                />
              </div>

              {/* Email Verification */}
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>
                    Require Email Verification
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                    Users must verify their email address before accessing the game server portal.
                  </p>
                </div>
                <Toggle
                  checked={bool("auth.emailVerification")}
                  onChange={() => toggleBool("auth.emailVerification")}
                />
              </div>

              <div className="h-px" style={{ backgroundColor: "var(--color-rp-border)" }} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Session Duration (Hours)"
                  type="number"
                  value={s["auth.sessionDurationHours"] ?? "24"}
                  onChange={(e) => update("auth.sessionDurationHours", e.target.value)}
                  hint="How long authenticated sessions remain valid before re-login."
                />
                <Input
                  label="Max Login Attempts"
                  type="number"
                  value={s["auth.maxLoginAttempts"] ?? "5"}
                  onChange={(e) => update("auth.maxLoginAttempts", e.target.value)}
                  hint="Account temporarily throttled after consecutive failures."
                />
              </div>
            </SettingsSection>
          )}

          {/* Security & Access Protection */}
          {showSecurity && (
            <SettingsSection
              title="Security & Access Protection"
              description="Password complexity rules and API rate limiting"
              icon={Lock}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>
                    Require Strong Passwords
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                    Enforce minimum 8 characters with numbers and special symbols.
                  </p>
                </div>
                <Toggle
                  checked={bool("security.requireStrongPasswords")}
                  onChange={() => toggleBool("security.requireStrongPasswords")}
                />
              </div>

              <div className="h-px" style={{ backgroundColor: "var(--color-rp-border)" }} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Minimum Password Length"
                  type="number"
                  value={s["security.minPasswordLength"] ?? "8"}
                  onChange={(e) => update("security.minPasswordLength", e.target.value)}
                />
                <Input
                  label="API Rate Limit (Req / Min)"
                  type="number"
                  value={s["security.apiRateLimit"] ?? "100"}
                  onChange={(e) => update("security.apiRateLimit", e.target.value)}
                  hint="Requests allowed per minute per IP address."
                />
              </div>
            </SettingsSection>
          )}
        </div>

        {/* Right Column: Server Defaults, Node Fleet & Branding */}
        <div className="space-y-6">
          {/* Server Provisioning Defaults */}
          {showServers && (
            <SettingsSection
              title="Server Provisioning Defaults"
              description="Default quotas applied to newly created game servers"
              icon={Server}
            >
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Default RAM (MB)"
                  type="number"
                  value={s["server.defaultRamMb"] ?? "1024"}
                  onChange={(e) => update("server.defaultRamMb", e.target.value)}
                />
                <Input
                  label="Default CPU (%)"
                  type="number"
                  value={s["server.defaultCpuPercent"] ?? "100"}
                  onChange={(e) => update("server.defaultCpuPercent", e.target.value)}
                />
                <Input
                  label="Default Disk (MB)"
                  type="number"
                  value={s["server.defaultDiskMb"] ?? "5120"}
                  onChange={(e) => update("server.defaultDiskMb", e.target.value)}
                />
              </div>

              <Input
                label="Max Backups Per Server"
                type="number"
                value={s["server.maxBackupsPerServer"] ?? "10"}
                onChange={(e) => update("server.maxBackupsPerServer", e.target.value)}
                hint="Maximum backup snapshots allowed per instance."
              />
            </SettingsSection>
          )}

          {/* Node Fleet Configuration */}
          {showNodes && (
            <SettingsSection
              title="Node Fleet & Heartbeat Monitors"
              description="Daemon agent health check and timeout thresholds"
              icon={MonitorSpeaker}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Heartbeat Interval (Seconds)"
                  type="number"
                  value={s["node.heartbeatIntervalSeconds"] ?? "30"}
                  onChange={(e) => update("node.heartbeatIntervalSeconds", e.target.value)}
                  hint="Interval between agent ping reports."
                />
                <Input
                  label="Node Offline Threshold (Seconds)"
                  type="number"
                  value={s["node.offlineTimeoutSeconds"] ?? "90"}
                  onChange={(e) => update("node.offlineTimeoutSeconds", e.target.value)}
                  hint="Mark node offline if no ping received."
                />
              </div>
            </SettingsSection>
          )}

          {/* Branding & Customization Quick Link */}
          <div
            className="p-6 rounded-2xl border flex items-center justify-between gap-4"
            style={{
              backgroundColor: "var(--color-rp-surface)",
              borderColor: "var(--color-rp-border)",
            }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(163, 230, 53, 0.12)",
                  border: "1px solid rgba(163, 230, 53, 0.25)",
                }}
              >
                <Palette className="w-5 h-5 text-lime-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>
                  Branding, Logo &amp; Themes
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                  Site Name, Logos, Favicon, Accent Colors, Social Links, and Announcement Banners.
                </p>
              </div>
            </div>
            <Link
              href="/customization"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110 active:scale-95 text-black"
              style={{ backgroundColor: "var(--color-rp-accent)" }}
            >
              <span>Open Designer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Full-Width Section: Cryo-Sleep Engine */}
        {showCryo && (
          <div className="col-span-full">
            <SettingsSection
              title="Cryo-Sleep Engine (0-RAM Hibernation &amp; TCP Wake Proxy)"
              description="Zero-resource power saver technology with auto wake-on-ping"
              icon={Zap}
              badge="0-RAM Technology"
            >
              <div className="space-y-5">
                {/* Informational Banner */}
                <div
                  className="p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed"
                  style={{
                    backgroundColor: "rgba(163, 230, 53, 0.06)",
                    borderColor: "rgba(163, 230, 53, 0.25)",
                    color: "var(--color-rp-text)",
                  }}
                >
                  <Activity className="w-5 h-5 text-lime-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-lime-400">0-RAM Server Hibernation:</span> When no players are active, Rubber Panel automatically suspends the container to disk, dropping RAM and CPU consumption to <strong>0%</strong>. A lightweight native proxy stays listening on the server port, instantly waking and booting the instance the moment a player connects or pings the server in their Minecraft client.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Toggles */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
                          Enable Cryo-Sleep by Default on New Servers
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                          Newly provisioned instances will have hibernation enabled automatically.
                        </p>
                      </div>
                      <Toggle
                        checked={bool("cryosleep.defaultEnabled")}
                        onChange={() => toggleBool("cryosleep.defaultEnabled")}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
                          Allow Users to Customize Wake MOTD
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                          Permits server owners to edit their sleep MOTD directly in their user panel.
                        </p>
                      </div>
                      <Toggle
                        checked={bool("cryosleep.allowUserCustomMotd")}
                        onChange={() => toggleBool("cryosleep.allowUserCustomMotd")}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
                          Auto-Configure Cryo-Sleep on New Nodes
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                          Initializes the TCP wake listener daemon on newly registered nodes.
                        </p>
                      </div>
                      <Toggle
                        checked={bool("cryosleep.autoConfigureNewNodes")}
                        onChange={() => toggleBool("cryosleep.autoConfigureNewNodes")}
                      />
                    </div>

                    <Input
                      label="Default Idle Timeout (Minutes)"
                      type="number"
                      value={s["cryosleep.defaultIdleMinutes"] ?? "10"}
                      onChange={(e) => update("cryosleep.defaultIdleMinutes", e.target.value)}
                      hint="Minutes with 0 online players before instance enters 0-RAM hibernation."
                    />
                  </div>

                  {/* MOTD & Wake Screen Message */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold flex items-center justify-between" style={{ color: "var(--color-rp-text)" }}>
                        <span>Multiplayer List Ping MOTD (Sleeping)</span>
                        <span className="font-mono text-[10px] text-lime-400">§ Color Codes Supported</span>
                      </label>
                      <textarea
                        rows={3}
                        value={s["cryosleep.defaultMotd"] ?? "§bRubber Panel §8| §3Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!"}
                        onChange={(e) => update("cryosleep.defaultMotd", e.target.value)}
                        className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
                        style={{
                          backgroundColor: "var(--color-rp-surface-2)",
                          borderColor: "var(--color-rp-border-2)",
                          color: "var(--color-rp-text)",
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
                        Auto-Wake Kick Screen Message (During login handshake)
                      </label>
                      <textarea
                        rows={3}
                        value={s["cryosleep.wakeMessage"] ?? "§b§lRubber Panel §8— §3§lCRYO-SLEEP WAKE-UP\\n\\n§aServer wake sequence initiated!\\n§7The instance is now booting from hibernation.\\n\\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)"}
                        onChange={(e) => update("cryosleep.wakeMessage", e.target.value)}
                        className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
                        style={{
                          backgroundColor: "var(--color-rp-surface-2)",
                          borderColor: "var(--color-rp-border-2)",
                          color: "var(--color-rp-text)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
  );
}
