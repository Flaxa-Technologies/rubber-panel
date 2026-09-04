"use client";

import { useState, useEffect, useCallback } from "react";
import { useServer } from "@/components/server/ServerContext";
import { formatDisk, formatRam } from "@/lib/server-utils";
import {
  Settings, Shield, Zap, Box, Globe, Save, AlertTriangle, Loader2, Check,
  Coffee, Sparkles, Cpu, HardDrive, Terminal, RefreshCw, CheckCircle2,
  ShieldCheck, ShieldAlert, Code2, Play, Moon, FolderOpen, Copy, ExternalLink,
  Package, Layers, Lock, Flame, Tag
} from "lucide-react";
import { useSession } from "next-auth/react";
import { copyToClipboard } from "@/lib/clipboard";
import { getSoftwareLogo } from "@/lib/software-catalog";
import ChangeSoftwareModal from "@/components/server/ChangeSoftwareModal";
import ChangeVersionModal from "@/components/server/ChangeVersionModal";
import ReinstallServerModal from "@/components/server/ReinstallServerModal";

interface JavaVersionItem {
  id: string;
  name: string;
  version: string;
  dockerImage?: string | null;
  binaryPath?: string | null;
  isDefault: boolean;
  nodeId?: string | null;
  description?: string | null;
}

const NODEJS_VERSIONS = [
  { version: "22", name: "Node.js 22 (Current LTS)", description: "Latest LTS release with state-of-the-art V8 engine and ESM performance." },
  { version: "20", name: "Node.js 20 (Active LTS)", description: "Standard active production LTS runtime with battle-tested ecosystem stability." },
  { version: "18", name: "Node.js 18 (Maintenance LTS)", description: "Compatible with older packages and legacy backend microservices." },
  { version: "23", name: "Node.js 23 (Latest)", description: "Cutting-edge Node.js runtime for modern development and experimentation." },
];

function MinecraftMotdPreview({ text }: { text: any }) {
  const defaultText = "§bRubber Panel §8| §3Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!";
  const raw = String(text || defaultText).replace(/\\n/g, "\n");

  const lines = raw.split("\n");

  const parseMinecraftFormatting = (line: string) => {
    const parts = line.split(/(§[0-9a-fk-or])/gi);
    let currentColor = "#ffffff";
    let isBold = false;
    let isItalic = false;

    const colorMap: Record<string, string> = {
      "§0": "#000000", "§1": "#0000aa", "§2": "#00aa00", "§3": "#00aaaa",
      "§4": "#aa0000", "§5": "#aa00aa", "§6": "#ffaa00", "§7": "#aaaaaa",
      "§8": "#555555", "§9": "#5555ff", "§a": "#55ff55", "§b": "#55ffff",
      "§c": "#ff5555", "§d": "#ff55ff", "§e": "#ffff55", "§f": "#ffffff",
    };

    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const lower = part.toLowerCase();

      if (colorMap[lower]) {
        currentColor = colorMap[lower];
      } else if (lower === "§l") {
        isBold = true;
      } else if (lower === "§o") {
        isItalic = true;
      } else if (lower === "§r") {
        currentColor = "#ffffff";
        isBold = false;
        isItalic = false;
      } else if (!part.startsWith("§")) {
        elements.push(
          <span
            key={i}
            style={{
              color: currentColor,
              fontWeight: isBold ? 700 : 400,
              fontStyle: isItalic ? "italic" : "normal",
            }}
          >
            {part}
          </span>
        );
      }
    }

    return elements.length > 0 ? elements : <span>{line}</span>;
  };

  return (
    <div style={{
      padding: "12px 14px",
      background: "#111116",
      borderRadius: 8,
      border: "1px solid #272730",
      fontFamily: "'Minecraft', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      minHeight: 52,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
    }}>
      {lines.map((ln, idx) => (
        <div key={idx} style={{ minHeight: 18 }}>
          {parseMinecraftFormatting(ln)}
        </div>
      ))}
    </div>
  );
}

function Section({
  title, description, children, action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="saas-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16, width: "100%" }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-surface-elevated)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-pure)" }}>{title}</h3>
          {description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{description}</p>}
        </div>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, width: "100%" }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { server, refreshServer } = useServer();

  const isNodeJs = server.serverType === "NODEJS" || server.software?.type === "NODEJS";
  const isDatabase = server.serverType === "DATABASE" || server.software?.type === "DATABASE";
  const isCustom = server.serverType === "CUSTOM";
  const isPumpkin = server.serverType === "PUMPKIN" || server.software?.type === "PUMPKIN" || server.software?.name?.toLowerCase().includes("pumpkin");
  const isMinecraft = !isNodeJs && !isDatabase && !isCustom && (server.serverType === "MINECRAFT" || isPumpkin || !server.serverType || !!server.software);

  // Admin Permissions
  const canChangeSoftware = server.allowChangeSoftware !== false;
  const canChangeVersion = server.allowChangeVersion !== false;
  const canEditStartup = server.allowEditStartup !== false;

  const [name, setName] = useState(server.name);
  const [startupCmd, setStartupCmd] = useState(server.startupCommand ?? (isNodeJs ? "node server.js" : ""));
  const [selectedJavaVersion, setSelectedJavaVersion] = useState<string>(server.javaVersion || "21");
  const [selectedJavaVersionId, setSelectedJavaVersionId] = useState<string>(server.javaVersionId || "");
  const [selectedNodeVersion, setSelectedNodeVersion] = useState<string>(server.nodeVersion || "20");
  const [securityProtection, setSecurityProtection] = useState<boolean>(server.securityProtection !== false);
  const [cryoSleepMotd, setCryoSleepMotd] = useState<string>(server.cryoSleepMotd ?? "");
  const [internalPort, setInternalPort] = useState(server.internalPort ? String(server.internalPort) : "");

  const [javaVersions, setJavaVersions] = useState<JavaVersionItem[]>([]);
  const [loadingJava, setLoadingJava] = useState(isMinecraft && !isPumpkin);

  const { data: session } = useSession();
  const [copiedSftp, setCopiedSftp] = useState<string | null>(null);
  const sessionUser = session?.user as any;
  const sftpUsername = `${sessionUser?.username || sessionUser?.name || "user"}.${(server.uuid || server.id).replace(/-/g, "").slice(0, 8)}`;
  const sftpHost = server.node?.fqdn || (server.node as any)?.ip || "127.0.0.1";
  const sftpPort = 2022;
  const sftpAddress = `sftp://${sftpUsername}@${sftpHost}:${sftpPort}`;
  const isSftpEnabled = (server as any).sftpEnabled !== false;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Modals state
  const [showSoftwareModal, setShowSoftwareModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showReinstallModal, setShowReinstallModal] = useState(false);
  const [customReinstallTarget, setCustomReinstallTarget] = useState<{ softwareType?: string; version?: string } | null>(null);

  const [savingJavaId, setSavingJavaId] = useState<string | null>(null);

  // Sync state if server context updates
  useEffect(() => {
    setName(server.name);
    setStartupCmd(server.startupCommand ?? (isNodeJs ? "node server.js" : ""));
    if (server.nodeVersion) setSelectedNodeVersion(server.nodeVersion);
    setSecurityProtection(server.securityProtection !== false);
    setCryoSleepMotd(server.cryoSleepMotd ?? "");
    setInternalPort(server.internalPort ? String(server.internalPort) : "");
  }, [server.name, server.startupCommand, server.nodeVersion, server.securityProtection, server.cryoSleepMotd, server.internalPort, isNodeJs]);

  // Load available Java versions for Minecraft server (non-pumpkin)
  const loadJavaVersions = useCallback(async () => {
    if (!isMinecraft || isPumpkin) return;
    setLoadingJava(true);
    try {
      const res = await fetch(`/api/user/servers/${server.id}/java-versions`);
      if (res.ok) {
        const data = await res.json();
        setJavaVersions(data.javaVersions || []);
        if (data.currentJavaVersion && !selectedJavaVersion) {
          setSelectedJavaVersion(data.currentJavaVersion);
        }
        if (data.currentJavaVersionId && !selectedJavaVersionId) {
          setSelectedJavaVersionId(data.currentJavaVersionId);
        }
      }
    } catch (err) {
      console.error("Failed to load Java versions:", err);
    } finally {
      setLoadingJava(false);
    }
  }, [server.id, isMinecraft, isPumpkin, selectedJavaVersion, selectedJavaVersionId]);

  useEffect(() => {
    if (isMinecraft && !isPumpkin) {
      loadJavaVersions();
    }
  }, [loadJavaVersions, isMinecraft, isPumpkin]);

  // Instant auto-save when clicking a Java version
  async function handleSelectJavaVersion(jv: JavaVersionItem) {
    if (selectedJavaVersionId === jv.id || savingJavaId) return;
    setSelectedJavaVersion(jv.version);
    setSelectedJavaVersionId(jv.id);
    setSavingJavaId(jv.id);
    setSaveError("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          javaVersion: jv.version,
          javaVersionId: jv.id,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await refreshServer?.();
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to save Java version");
      }
    } catch {
      setSaveError("Failed to save Java version");
    } finally {
      setSavingJavaId(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const payload: any = {
        name: name.trim(),
        startupCommand: canEditStartup ? (startupCmd.trim() || (isNodeJs ? "node server.js" : undefined)) : undefined,
        cryoSleepMotd: cryoSleepMotd.trim() || undefined,
        internalPort: internalPort.trim() ? parseInt(internalPort.trim(), 10) : null,
      };

      if (isNodeJs) {
        payload.nodeVersion = selectedNodeVersion;
        payload.securityProtection = securityProtection;
      } else if (!isPumpkin) {
        payload.javaVersion = selectedJavaVersion;
        payload.javaVersionId = selectedJavaVersionId || undefined;
      }

      const res = await fetch(`/api/user/servers/${server.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save settings");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await refreshServer?.();
    } catch {
      setSaveError("Network error while saving settings");
    } finally {
      setSaving(false);
    }
  }

  const activeSoftwareName = isPumpkin
    ? "Pumpkin MC (Rust)"
    : (server.software?.name ?? (isNodeJs ? "Node.js" : isDatabase ? "Database" : "Minecraft Paper"));

  const activeSoftwareLogo = getSoftwareLogo(isPumpkin ? "PUMPKIN" : (server.software?.type || server.serverType));

  const activeVersionName = isPumpkin
    ? "Nightly"
    : (server.softwareVersion?.version ?? (isNodeJs ? `Node.js v${server.nodeVersion || "20"}` : "1.21.1"));

  return (
    <div style={{ width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Quarantine Alert if Suspended for Security */}
      {server.securitySuspendedUntil && new Date(server.securitySuspendedUntil) > new Date() && (
        <div style={{
          padding: "16px 20px",
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 10,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", flexShrink: 0 }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#f87171", margin: 0 }}>
                Security Shield Quarantine Active (5-Minute Suspension)
              </h4>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#ef4444", color: "#ffffff" }}>
                TEMPORARY LOCK
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-primary)", marginTop: 4, lineHeight: 1.4 }}>
              {server.securityQuarantineReason || "Harmful code patterns (e.g. child process execution or malicious downloads) were detected in your server files."}
            </p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
              Quarantine automatically expires at: <strong style={{ color: "#ffffff" }}>{new Date(server.securitySuspendedUntil).toLocaleTimeString()}</strong>. Please remove malicious files before restarting.
            </p>
          </div>
        </div>
      )}

      {/* Main Settings Responsive Grid (Desktop: 2 Columns, Mobile: 1 Column) */}
      <form onSubmit={handleSave} style={{ width: "100%" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
            gap: 16,
            width: "100%",
            alignItems: "start",
          }}
        >
          {/* ======================= LEFT COLUMN ======================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
            
            {/* 1. Server Software & Version Management Card */}
            <Section
              title="Server Software & Engine"
              description="Current server runtime, platform distribution, and version"
              action={
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {canChangeVersion && (
                    <button
                      type="button"
                      onClick={() => setShowVersionModal(true)}
                      className="btn btn-secondary"
                      style={{
                        padding: "5px 12px",
                        fontSize: 11.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Tag size={12} />
                      <span>Change Version</span>
                    </button>
                  )}
                  {canChangeSoftware && (
                    <button
                      type="button"
                      onClick={() => setShowSoftwareModal(true)}
                      className="btn btn-primary"
                      style={{
                        padding: "5px 12px",
                        fontSize: 11.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Sparkles size={12} />
                      <span>Change Software</span>
                    </button>
                  )}
                  {!canChangeSoftware && !canChangeVersion && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title="Admin has disabled software and version changes for this instance"
                    >
                      <Lock size={10} />
                      <span>Locked by Admin</span>
                    </span>
                  )}
                </div>
              }
            >
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img
                    src={activeSoftwareLogo}
                    alt={activeSoftwareName}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      objectFit: "contain",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      padding: 4,
                      border: "1px solid rgba(255,255,255,0.08)",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                        {activeSoftwareName}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "1px 7px",
                          borderRadius: 4,
                          backgroundColor: isPumpkin ? "rgba(249, 115, 22, 0.15)" : "rgba(56, 189, 248, 0.15)",
                          color: isPumpkin ? "#f97316" : "#38bdf8",
                          border: `1px solid ${isPumpkin ? "rgba(249, 115, 22, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
                        }}
                      >
                        v{activeVersionName}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                      {isPumpkin
                        ? "Multithreaded Rust architecture. Native Java & Bedrock support."
                        : `Standard Minecraft instance managed via Rubber Panel.`}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {canChangeVersion && (
                    <button
                      type="button"
                      onClick={() => setShowVersionModal(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Tag size={12} />
                      <span>Change Version...</span>
                    </button>
                  )}
                  {canChangeSoftware && (
                    <button
                      type="button"
                      onClick={() => setShowSoftwareModal(true)}
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Sparkles size={12} />
                      <span>Switch Software...</span>
                    </button>
                  )}
                </div>
              </div>
            </Section>

            {/* 2. General Identity */}
            <Section title="General Identity" description="Display identification for this server instance">
              <Field label="Server Name" hint="Friendly display name for this instance.">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={64}
                  required
                  className="saas-input"
                />
              </Field>

              <Field
                label="Internal Container Port (Manual Override)"
                hint="Port the container listens on internally (e.g. 25565 for Minecraft, 3306 for MySQL, 3000 for Web). Leave blank for auto-detection."
              >
                <input
                  type="number"
                  value={internalPort}
                  onChange={e => setInternalPort(e.target.value)}
                  placeholder="Auto-detected (e.g. 25565, 3306, 3000)"
                  className="saas-input"
                  style={{ fontFamily: "monospace", fontSize: 12.5 }}
                />
              </Field>
            </Section>

            {/* 3. Startup & Launch Command */}
            <Section
              title="Startup Command"
              description="Custom execution command, flags, and entrypoint options"
              action={
                !canEditStartup && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 6,
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      color: "#f87171",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Lock size={10} />
                    <span>Locked by Admin</span>
                  </span>
                )
              }
            >
              <Field
                label="Startup Command"
                hint={
                  !canEditStartup
                    ? "Administrator has restricted startup script modification for this instance."
                    : isNodeJs
                    ? "Default: node server.js (or 'npm start', 'node index.js')"
                    : isDatabase
                    ? "Default entrypoint / startup flags for database container."
                    : "Leave blank to use default. {{SERVER_MEMORY}} expands to allocated RAM."
                }
              >
                <input
                  value={startupCmd}
                  onChange={e => setStartupCmd(e.target.value)}
                  placeholder={isNodeJs ? "node server.js" : isDatabase ? "docker-entrypoint.sh mysqld" : "java -Xms256M -Xmx{{SERVER_MEMORY}}M -jar server.jar --nogui"}
                  className="saas-input"
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12.5,
                    opacity: canEditStartup ? 1 : 0.65,
                    cursor: canEditStartup ? "text" : "not-allowed",
                  }}
                  readOnly={!canEditStartup}
                  disabled={!canEditStartup}
                />
              </Field>
            </Section>

            {/* 4. Cryo-Sleep (0-RAM Hibernation & Wake Proxy for Minecraft) */}
            {isMinecraft && !isPumpkin && (
              <Section
                title="Cryo-Sleep (0-RAM Hibernation & Auto-Wake)"
                description="Automatic memory-saving hibernation that sleeps empty instances and auto-boots on connection."
                action={
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: server.cryoSleepEnabled ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.05)",
                    color: server.cryoSleepEnabled ? "#38bdf8" : "var(--text-dim)",
                    border: `1px solid ${server.cryoSleepEnabled ? "rgba(56, 189, 248, 0.3)" : "var(--border-subtle)"}`,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}>
                    <Moon size={11} />
                    <span>{server.cryoSleepEnabled ? `Active (${server.cryoSleepIdleMinutes || 10}m Timeout)` : "Disabled"}</span>
                  </span>
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{
                    padding: "12px 14px",
                    background: "rgba(56, 189, 248, 0.05)",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
                  }}>
                    <strong>0-RAM Technology:</strong> When 0 players are connected for {server.cryoSleepIdleMinutes || 10} consecutive minutes, your server process enters Cryo-Sleep. A lightweight wake proxy takes over your server port to listen for connections. Joining the server instantly wakes and starts your Minecraft world.
                  </div>

                  {server.cryoSleepCustomMotdAllowed !== false ? (
                    <Field
                      label="Custom Cryo-Sleep Wake MOTD"
                      hint="Displayed in player server lists when sleeping. Use § color codes for custom formatting."
                    >
                      <textarea
                        value={cryoSleepMotd}
                        onChange={e => setCryoSleepMotd(e.target.value)}
                        placeholder="§bRubber Panel §8| §3Server is in Cryo-Sleep\n§e§lClick to Connect & Auto-Wake Instance!"
                        rows={3}
                        className="saas-input"
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12.5,
                          resize: "vertical",
                          minHeight: 70,
                          lineHeight: 1.4,
                        }}
                      />

                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                          Multiplayer List Live Preview:
                        </div>
                        <MinecraftMotdPreview text={cryoSleepMotd} />
                      </div>
                    </Field>
                  ) : (
                    <div style={{
                      padding: "12px 14px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        Default Rubber Panel Wake MOTD (Locked by Admin):
                      </div>
                      <MinecraftMotdPreview text={server.cryoSleepMotd || ""} />
                      <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, margin: 0 }}>
                        *Custom MOTD customization is disabled by administrators for this tier.
                      </p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Save Buttons */}
            {saveError && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
                {saveError}
              </div>
            )}

            <div>
              <button type="submit" disabled={saving} className="btn-solid-white" style={{ padding: "10px 24px", fontSize: 13, fontWeight: 600 }}>
                {saving ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                <span>{saving ? "Saving Changes..." : saved ? "Changes Saved!" : "Save All Changes"}</span>
              </button>
            </div>
          </div>

          {/* ======================= RIGHT COLUMN ======================= */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>

            {/* 1. Hardware Limits Card */}
            <Section title="Hardware Limits" description="Resource limits allocated to this server instance">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
                <Field label="RAM Limit">
                  <input value={formatRam(server.ram)} readOnly disabled className="saas-input" style={{ opacity: 0.65, cursor: "not-allowed", fontWeight: 700 }} />
                </Field>
                <Field label="CPU Core">
                  <input value={`${server.cpu}%`} readOnly disabled className="saas-input" style={{ opacity: 0.65, cursor: "not-allowed", fontWeight: 700 }} />
                </Field>
                <Field label="Storage">
                  <input value={formatDisk(server.disk)} readOnly disabled className="saas-input" style={{ opacity: 0.65, cursor: "not-allowed", fontWeight: 700 }} />
                </Field>
              </div>
            </Section>

            {/* 2. Java Runtime Environment (for Java Minecraft) */}
            {isMinecraft && !isPumpkin && (
              <Section
                title="Java Runtime Environment"
                description="Select the JDK runtime version available on your server node."
                action={
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}>
                      <Coffee size={11} />
                      Active: Java {selectedJavaVersion}
                    </span>
                  </div>
                }
              >
                {loadingJava ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "30px 0", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
                    <Loader2 size={16} className="spin" />
                    <span>Scanning node Java runtimes...</span>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                    {javaVersions.map((jv) => {
                      const isSelected = selectedJavaVersionId === jv.id || (!selectedJavaVersionId && selectedJavaVersion === jv.version);
                      const isSavingThis = savingJavaId === jv.id;
                      return (
                        <div
                          key={jv.id}
                          onClick={() => handleSelectJavaVersion(jv)}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: isSelected ? "1.5px solid #38bdf8" : "1px solid var(--border-subtle)",
                            background: isSelected ? "rgba(56, 189, 248, 0.08)" : "var(--bg-surface)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 5,
                                background: isSelected ? "rgba(56, 189, 248, 0.2)" : "#1f1f26",
                                color: isSelected ? "#38bdf8" : "#ffffff",
                              }}>
                                JDK {jv.version}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                                {jv.name}
                              </span>
                            </div>
                            {isSavingThis ? (
                              <Loader2 size={14} className="spin" style={{ color: "#38bdf8" }} />
                            ) : isSelected ? (
                              <CheckCircle2 size={15} style={{ color: "#38bdf8" }} />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {/* 3. SFTP Connection Details Card (Pterodactyl-Style) */}
            <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                    <FolderOpen size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                      SFTP Remote Access Details
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isSftpEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: isSftpEnabled ? "#10b981" : "#ef4444", border: `1px solid ${isSftpEnabled ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}` }}>
                        {isSftpEnabled ? "PORT 2022 ACTIVE" : "DISABLED"}
                      </span>
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, margin: 0 }}>
                      Direct file management with FileZilla, WinSCP, or Cyberduck
                    </p>
                  </div>
                </div>

                {isSftpEnabled && (
                  <a
                    href={sftpAddress}
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <ExternalLink size={13} />
                    <span>Launch SFTP</span>
                  </a>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, backgroundColor: "rgba(0, 0, 0, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Host / Address</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#ffffff" }}>{sftpHost}</span>
                    <button type="button" onClick={() => { copyToClipboard(sftpHost); setCopiedSftp("sftp-host"); setTimeout(() => setCopiedSftp(null), 2000); }} className="btn btn-ghost" style={{ padding: 2 }}>
                      {copiedSftp === "sftp-host" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Port</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#ffffff" }}>2022</span>
                    <button type="button" onClick={() => { copyToClipboard("2022"); setCopiedSftp("sftp-port"); setTimeout(() => setCopiedSftp(null), 2000); }} className="btn btn-ghost" style={{ padding: 2 }}>
                      {copiedSftp === "sftp-port" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Username</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#ffffff" }}>{sftpUsername}</span>
                    <button type="button" onClick={() => { copyToClipboard(sftpUsername); setCopiedSftp("sftp-user"); setTimeout(() => setCopiedSftp(null), 2000); }} className="btn btn-ghost" style={{ padding: 2 }}>
                      {copiedSftp === "sftp-user" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Password</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontStyle: "italic" }}>
                    Your Account Password
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Danger Zone — Reinstall Instance with File Preservation */}
            <div className="saas-card" style={{ padding: 0, overflow: "hidden", borderColor: "rgba(239, 68, 68, 0.3)", width: "100%" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.08)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f87171", margin: 0 }}>Danger Zone</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, margin: 0 }}>Irreversible server maintenance operations</p>
              </div>

              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Reinstall Server Instance</h4>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, margin: 0 }}>
                      Reinstalls the server engine. Allows you to choose which files and folders (e.g. <code>world</code>, <code>plugins</code>, <code>config</code>) to keep safe.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomReinstallTarget(null);
                      setShowReinstallModal(true);
                    }}
                    className="btn-danger-dark"
                    style={{ fontSize: 12.5, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={13} />
                    <span>Reinstall Server...</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </form>

      {/* Change Version Modal */}
      <ChangeVersionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        server={server}
        onSuccess={async () => {
          await refreshServer?.();
        }}
        onTriggerReinstallWithVersion={(version) => {
          const currentType = server.software?.type || (server.serverType === "PUMPKIN" ? "PUMPKIN" : "PAPER");
          setCustomReinstallTarget({ softwareType: currentType, version });
          setShowReinstallModal(true);
        }}
      />

      {/* Change Software Modal */}
      <ChangeSoftwareModal
        isOpen={showSoftwareModal}
        onClose={() => setShowSoftwareModal(false)}
        server={server}
        onSuccess={async () => {
          await refreshServer?.();
        }}
        onTriggerReinstallWithSoftware={(softwareType, version) => {
          setCustomReinstallTarget({ softwareType, version });
          setShowReinstallModal(true);
        }}
      />

      {/* Reinstall Modal with File Preservation */}
      <ReinstallServerModal
        isOpen={showReinstallModal}
        onClose={() => {
          setShowReinstallModal(false);
          setCustomReinstallTarget(null);
        }}
        server={server}
        onSuccess={async () => {
          await refreshServer?.();
        }}
        customSoftwareType={customReinstallTarget?.softwareType}
        customVersion={customReinstallTarget?.version}
      />
    </div>
  );
}
