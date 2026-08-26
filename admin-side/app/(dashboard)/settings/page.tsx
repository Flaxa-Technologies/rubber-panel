"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Toggle } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Save, Shield, Server, MonitorSpeaker, Palette, Lock, AlertCircle, Check, Zap } from "lucide-react";

interface SettingsData {
  [key: string]: string;
}

function SettingsSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--color-rp-accent-glow)" }}>
          <Icon className="w-4 h-4" style={{ color: "var(--color-rp-accent)" }} />
        </div>
        <h3 className="font-semibold" style={{ color: "var(--color-rp-text)" }}>{title}</h3>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d.settings ?? {}); setLoading(false); });
  }, []);

  function update(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function toggleBool(key: string) {
    setSettings((s) => ({ ...s, [key]: s[key] === "true" ? "false" : "true" }));
  }

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else { const d = await res.json(); setError(d.error ?? "Failed to save"); }
    setSaving(false);
  }

  const s = settings;
  const bool = (k: string) => s[k] === "true";

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        {[...Array(4)].map((_, i) => <div key={i} className="h-48 skeleton rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>Configure your Rubber Panel installation</p>
        <div className="flex items-center gap-3">
          {saved && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-rp-green)" }}>
              <Check className="w-4 h-4" /> Saved
            </div>
          )}
          {error && <p className="text-sm" style={{ color: "var(--color-rp-red)" }}>{error}</p>}
          <Button icon={Save} loading={saving} onClick={save}>Save Settings</Button>
        </div>
      </div>

      {/* Authentication */}
      <SettingsSection title="Authentication" icon={Shield}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>Allow New User Registration</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
              When disabled, only administrators can create accounts. The registration page on user-side will be hidden and the API will reject registration attempts.
            </p>
          </div>
          <Toggle
            checked={bool("auth.registrationEnabled")}
            onChange={() => toggleBool("auth.registrationEnabled")}
          />
        </div>
        <div className="h-px" style={{ backgroundColor: "var(--color-rp-border)" }} />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>Email Verification Required</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>New users must verify their email before they can log in.</p>
          </div>
          <Toggle checked={bool("auth.emailVerification")} onChange={() => toggleBool("auth.emailVerification")} />
        </div>
        <div className="h-px" style={{ backgroundColor: "var(--color-rp-border)" }} />
        <Input
          label="Session Duration (hours)"
          type="number"
          value={s["auth.sessionDurationHours"] ?? "24"}
          onChange={(e) => update("auth.sessionDurationHours", e.target.value)}
          hint="How long admin sessions remain valid."
        />
        <Input
          label="Max Login Attempts"
          type="number"
          value={s["auth.maxLoginAttempts"] ?? "5"}
          onChange={(e) => update("auth.maxLoginAttempts", e.target.value)}
          hint="After this many failures, account is temporarily locked."
        />
      </SettingsSection>

      {/* Security */}
      <SettingsSection title="Security" icon={Lock}>
        <Toggle
          checked={bool("security.requireStrongPasswords")}
          onChange={() => toggleBool("security.requireStrongPasswords")}
          label="Require Strong Passwords"
          description="Enforce minimum password complexity rules."
        />
        <Input
          label="Minimum Password Length"
          type="number"
          value={s["security.minPasswordLength"] ?? "8"}
          onChange={(e) => update("security.minPasswordLength", e.target.value)}
        />
        <Input
          label="API Rate Limit (requests/minute)"
          type="number"
          value={s["security.apiRateLimit"] ?? "100"}
          onChange={(e) => update("security.apiRateLimit", e.target.value)}
        />
      </SettingsSection>

      {/* Server Defaults */}
      <SettingsSection title="Server Defaults" icon={Server}>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Default RAM (MB)" type="number" value={s["server.defaultRamMb"] ?? "1024"} onChange={(e) => update("server.defaultRamMb", e.target.value)} />
          <Input label="Default CPU (%)" type="number" value={s["server.defaultCpuPercent"] ?? "100"} onChange={(e) => update("server.defaultCpuPercent", e.target.value)} />
          <Input label="Default Disk (MB)" type="number" value={s["server.defaultDiskMb"] ?? "5120"} onChange={(e) => update("server.defaultDiskMb", e.target.value)} />
        </div>
        <Input label="Max Backups Per Server" type="number" value={s["server.maxBackupsPerServer"] ?? "10"} onChange={(e) => update("server.maxBackupsPerServer", e.target.value)} />
      </SettingsSection>

      {/* Node */}
      <SettingsSection title="Node Configuration" icon={MonitorSpeaker}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Heartbeat Interval (seconds)" type="number" value={s["node.heartbeatIntervalSeconds"] ?? "30"} onChange={(e) => update("node.heartbeatIntervalSeconds", e.target.value)} />
          <Input label="Node Offline Timeout (seconds)" type="number" value={s["node.offlineTimeoutSeconds"] ?? "90"} onChange={(e) => update("node.offlineTimeoutSeconds", e.target.value)} hint="After this period without a heartbeat, node is marked offline." />
        </div>
      </SettingsSection>

      {/* Cryo-Sleep (0-RAM Hibernation & Auto Wake-on-Ping) */}
      <SettingsSection title="Cryo-Sleep (0-RAM Hibernation & Wake Proxy)" icon={Zap}>
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-xs text-cyan-200 leading-relaxed">
            <span className="font-bold text-cyan-400">Cryo-Sleep Technology:</span> Automatically suspends empty Minecraft/Node.js servers to disk after the configured idle timeout (reducing RAM & CPU usage to <strong>0%</strong>). A lightweight native TCP wake proxy listens on the server&apos;s port and instantly boots the instance when a player joins or pings the server list.
          </div>

          <Toggle
            checked={bool("cryosleep.defaultEnabled")}
            onChange={() => toggleBool("cryosleep.defaultEnabled")}
            label="Enable Cryo-Sleep by Default for New Servers"
            description="When enabled, new servers will be provisioned with Cryo-Sleep active."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Default Idle Timeout (Minutes)"
              type="number"
              value={s["cryosleep.defaultIdleMinutes"] ?? "10"}
              onChange={(e) => update("cryosleep.defaultIdleMinutes", e.target.value)}
              hint="Minutes with 0 players online before instance enters hibernation."
            />
            <Toggle
              checked={bool("cryosleep.allowUserCustomMotd")}
              onChange={() => toggleBool("cryosleep.allowUserCustomMotd")}
              label="Allow Users to Customize Wake MOTD"
              description="Permit server owners to edit their Cryo-Sleep MOTD in their user panel."
            />
          </div>

          <Toggle
            checked={bool("cryosleep.autoConfigureNewNodes")}
            onChange={() => toggleBool("cryosleep.autoConfigureNewNodes")}
            label="Auto-Configure Cryo-Sleep Engine on New Nodes"
            description="Automatically initialize the native TCP wake proxy and idle monitoring daemon on newly connected nodes."
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
              Global Default Cryo-Sleep MOTD (Minecraft Color Codes Supported)
            </label>
            <textarea
              rows={3}
              value={s["cryosleep.defaultMotd"] ?? "§bRubber Panel §8| §3Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!"}
              onChange={(e) => update("cryosleep.defaultMotd", e.target.value)}
              className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
              style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
            />
            <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
              Displayed on in-game Multiplayer server list pings when instance is sleeping. Use <code>§b</code> (aqua), <code>§e</code> (yellow), <code>§a</code> (green), <code>§l</code> (bold), <code>\\n</code> (newline).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
              Auto-Wake Kick Screen Message (Shown during login handshake)
            </label>
            <textarea
              rows={3}
              value={s["cryosleep.wakeMessage"] ?? "§b§lRubber Panel §8— §3§lCRYO-SLEEP WAKE-UP\\n\\n§aServer wake sequence initiated!\\n§7The instance is now booting from hibernation.\\n\\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)"}
              onChange={(e) => update("cryosleep.wakeMessage", e.target.value)}
              className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
              style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Branding & Customization Hub Link */}
      <Card padding="none">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(163, 230, 53, 0.12)", border: "1px solid rgba(163, 230, 53, 0.25)" }}>
              <Palette className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>Branding, Logo & Customization</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                Manage Site Name, Logo, Favicon, Color Themes, Social Links, and Announcement Banners.
              </p>
            </div>
          </div>
          <Link
            href="/customization"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95 shadow-sm"
            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
          >
            <span>Open Customization</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
