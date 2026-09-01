"use client";

import { useState, useEffect, useCallback } from "react";
import { useServer } from "@/components/server/ServerContext";
import { formatDisk, formatRam } from "@/lib/server-utils";
import {
  Settings, Shield, Zap, Box, Globe, Save, AlertTriangle, Loader2, Check,
  Coffee, Sparkles, Cpu, HardDrive, Terminal, RefreshCw, CheckCircle2,
  ShieldCheck, ShieldAlert, Code2, Play, Moon
} from "lucide-react";

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
  const isMinecraft = !isNodeJs && !isDatabase && !isCustom && (server.serverType === "MINECRAFT" || !server.serverType || !!server.software);

  const [name, setName] = useState(server.name);
  const [startupCmd, setStartupCmd] = useState(server.startupCommand ?? (isNodeJs ? "node server.js" : ""));
  const [selectedJavaVersion, setSelectedJavaVersion] = useState<string>(server.javaVersion || "21");
  const [selectedJavaVersionId, setSelectedJavaVersionId] = useState<string>(server.javaVersionId || "");
  const [selectedNodeVersion, setSelectedNodeVersion] = useState<string>(server.nodeVersion || "20");
  const [securityProtection, setSecurityProtection] = useState<boolean>(server.securityProtection !== false);
  const [cryoSleepMotd, setCryoSleepMotd] = useState<string>(server.cryoSleepMotd ?? "");
  const [internalPort, setInternalPort] = useState(server.internalPort ? String(server.internalPort) : "");

  const [javaVersions, setJavaVersions] = useState<JavaVersionItem[]>([]);
  const [loadingJava, setLoadingJava] = useState(isMinecraft);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showReinstall, setShowReinstall] = useState(false);
  const [reinstallConfirm, setReinstallConfirm] = useState("");
  const [reinstalling, setReinstalling] = useState(false);
  const [reinstallError, setReinstallError] = useState("");

  // Sync state if server context updates
  useEffect(() => {
    setName(server.name);
    setStartupCmd(server.startupCommand ?? (isNodeJs ? "node server.js" : ""));
    if (server.javaVersion) setSelectedJavaVersion(server.javaVersion);
    if (server.javaVersionId) setSelectedJavaVersionId(server.javaVersionId);
    if (server.nodeVersion) setSelectedNodeVersion(server.nodeVersion);
    setSecurityProtection(server.securityProtection !== false);
    setCryoSleepMotd(server.cryoSleepMotd ?? "");
    setInternalPort(server.internalPort ? String(server.internalPort) : "");
  }, [server, isNodeJs]);

  // Load available Java versions for Minecraft server
  const loadJavaVersions = useCallback(async () => {
    if (!isMinecraft) return;
    setLoadingJava(true);
    try {
      const res = await fetch(`/api/user/servers/${server.id}/java-versions`);
      if (res.ok) {
        const data = await res.json();
        setJavaVersions(data.javaVersions || []);
        if (data.currentJavaVersion) {
          setSelectedJavaVersion(data.currentJavaVersion);
        }
        if (data.currentJavaVersionId) {
          setSelectedJavaVersionId(data.currentJavaVersionId);
        }
      }
    } catch (err) {
      console.error("Failed to load Java versions:", err);
    } finally {
      setLoadingJava(false);
    }
  }, [server.id, isMinecraft]);

  useEffect(() => {
    if (isMinecraft) {
      loadJavaVersions();
    }
  }, [loadJavaVersions, isMinecraft]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const payload: any = {
        name: name.trim(),
        startupCommand: startupCmd.trim() || (isNodeJs ? "node server.js" : undefined),
        cryoSleepMotd: cryoSleepMotd.trim() || undefined,
        internalPort: internalPort.trim() ? parseInt(internalPort.trim(), 10) : null,
      };

      if (isNodeJs) {
        payload.nodeVersion = selectedNodeVersion;
        payload.securityProtection = securityProtection;
      } else {
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

  async function handleReinstall() {
    if (reinstallConfirm !== server.name) return;
    setReinstalling(true);
    setReinstallError("");
    try {
      const res = await fetch(`/api/user/servers/${server.id}/reinstall`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setReinstallError(data.error ?? "Reinstall failed");
        return;
      }
      setShowReinstall(false);
      setReinstallConfirm("");
      await refreshServer?.();
    } catch {
      setReinstallError("Network error");
    } finally {
      setReinstalling(false);
    }
  }

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

      <form onSubmit={handleSave} style={{ width: "100%" }}>
        
        {/* Node.js Runtime vs Java Runtime Environment */}
        {isNodeJs ? (
          <Section
            title="Node.js Runtime Environment"
            description="Select the Node.js execution runtime version for your server instance."
            action={
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 6,
                background: "rgba(34, 197, 94, 0.12)",
                color: "#4ade80",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}>
                <Code2 size={12} />
                Active: Node.js v{selectedNodeVersion}
              </span>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {NODEJS_VERSIONS.map((nv) => {
                const isSelected = selectedNodeVersion === nv.version;
                return (
                  <div
                    key={nv.version}
                    onClick={() => setSelectedNodeVersion(nv.version)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--border-subtle)",
                      background: isSelected ? "rgba(34, 197, 94, 0.08)" : "var(--bg-surface)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: isSelected ? "rgba(34, 197, 94, 0.2)" : "#1c1c20",
                          border: isSelected ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid #2a2a30",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isSelected ? "#4ade80" : "var(--text-primary)",
                          fontWeight: 700,
                          fontSize: 13,
                          fontFamily: "monospace",
                        }}>
                          {nv.version}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-pure)" }}>
                            {nv.name}
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "monospace" }}>
                            node:{nv.version}-alpine
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--border-subtle)", flexShrink: 0, marginTop: 2 }} />
                      )}
                    </div>

                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                      {nv.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </Section>
        ) : isMinecraft ? (
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
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#fbbf24",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}>
                  <Coffee size={12} />
                  Active: Java {selectedJavaVersion}
                </span>
                <button
                  type="button"
                  onClick={loadJavaVersions}
                  disabled={loadingJava}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: "var(--text-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={11} className={loadingJava ? "spin" : ""} />
                  Sync
                </button>
              </div>
            }
          >
            {loadingJava ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                <Loader2 size={18} className="spin" style={{ margin: "0 auto 8px" }} />
                Loading available Java runtimes...
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {javaVersions.map((jv) => {
                  const isSelected = selectedJavaVersion === jv.version;
                  return (
                    <div
                      key={jv.id}
                      onClick={() => {
                        setSelectedJavaVersion(jv.version);
                        setSelectedJavaVersionId(jv.id);
                      }}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 10,
                        border: isSelected ? "1.5px solid #38bdf8" : "1px solid var(--border-subtle)",
                        background: isSelected ? "rgba(56, 189, 248, 0.08)" : "var(--bg-surface)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 8,
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isSelected ? "rgba(56, 189, 248, 0.2)" : "#1c1c20",
                            border: isSelected ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid #2a2a30",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isSelected ? "#38bdf8" : "var(--text-primary)",
                            fontWeight: 700,
                            fontSize: 13,
                            fontFamily: "monospace",
                          }}>
                            {jv.version}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-pure)", display: "flex", alignItems: "center", gap: 6 }}>
                              {jv.name}
                              {jv.isDefault && (
                                <span style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  background: "rgba(245, 158, 11, 0.15)",
                                  color: "#fbbf24",
                                  border: "1px solid rgba(245, 158, 11, 0.3)",
                                }}>
                                  Default
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "monospace" }}>
                              JDK {jv.version}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <CheckCircle2 size={16} style={{ color: "#38bdf8", flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid var(--border-subtle)", flexShrink: 0, marginTop: 2 }} />
                        )}
                      </div>

                      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                        {jv.description || `Java ${jv.version} execution environment.`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        ) : null}

        {/* Node.js Security Protection Shield Card */}
        {isNodeJs && (
          <Section
            title="Security Shield & Threat Protection"
            description="Automatic AST code scan that detects and neutralizes malicious Node.js scripts."
            action={
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 6,
                background: securityProtection ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                color: securityProtection ? "#4ade80" : "#f87171",
                border: `1px solid ${securityProtection ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}>
                {securityProtection ? (
                  <>
                    <Shield size={12} />
                    <span>Shield Active</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} />
                    <span>Shield Disabled</span>
                  </>
                )}
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
                <ShieldCheck size={20} style={{ color: "#4ade80", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  <strong>Real-Time Threat Scanner:</strong> Analyzes application source code before launch. Detects unauthorized <code>child_process</code> spawning, remote binary download pipes (e.g. <code>curl | sh</code>), and reverse shells.
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
                    *Files inside <code>node_modules/</code> and vendor dependencies are excluded to avoid false positives.
                  </p>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* General Identity */}
        <Section title="General" description="Basic server identity and display configuration">
          <Field label="Server Name" hint="Friendly display name for this instance.">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={64}
              required
              className="saas-input"
            />
          </Field>
        </Section>

        {/* Hardware Limits */}
        <Section title="Hardware Limits" description="Resource limits allocated to this server instance">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="RAM Limit">
              <input value={formatRam(server.ram)} readOnly disabled className="saas-input" style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </Field>
            <Field label="CPU Core">
              <input value={`${server.cpu}%`} readOnly disabled className="saas-input" style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </Field>
            <Field label="Storage">
              <input value={formatDisk(server.disk)} readOnly disabled className="saas-input" style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </Field>
          </div>
        </Section>

        {/* Cryo-Sleep (0-RAM Hibernation & Wake Proxy for Minecraft) */}
        {isMinecraft && (
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

                  {/* Live Minecraft Color Code Preview */}
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

        {/* Startup & Launch Command */}
        <Section title="Startup Command" description="Execution parameters, flags, and entrypoint options">
          <Field
            label="Startup Command"
            hint={isNodeJs ? "Default: node server.js (or 'npm start', 'node index.js')" : isDatabase ? "Default entrypoint / startup flags for database container." : "Leave blank to use default. {{SERVER_MEMORY}} expands to allocated RAM."}
          >
            <input
              value={startupCmd}
              onChange={e => setStartupCmd(e.target.value)}
              placeholder={isNodeJs ? "node server.js" : isDatabase ? "docker-entrypoint.sh mysqld" : "java -Xms256M -Xmx{{SERVER_MEMORY}}M -jar server.jar --nogui"}
              className="saas-input"
              style={{ fontFamily: "monospace", fontSize: 12.5 }}
            />
          </Field>
        </Section>

        {/* Software / Engine Details */}
        <Section title="Environment & Runtime" description="Operating runtime, container entrypoints, and port routing">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Field label="Platform Type">
              <input value={isNodeJs ? "Node.js JavaScript Runtime" : isDatabase ? "Database Container" : isCustom ? "Custom Container" : (server.software?.name ?? "Minecraft")} readOnly disabled className="saas-input" style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </Field>
            <Field label="Runtime Version">
              <input value={isNodeJs ? `Node.js v${server.nodeVersion || "20"}` : (server.softwareVersion?.version ?? "Container Default")} readOnly disabled className="saas-input" style={{ opacity: 0.6, cursor: "not-allowed" }} />
            </Field>
          </div>

          <Field
            label="Internal Container Port (Manual Override)"
            hint="Port the container listens on internally (e.g. 3306 for MySQL, 5432 for Postgres, 80 for Nginx, 3000 for Node/Web, 6379 for Redis). Leave blank for auto-detection via Docker inspect."
          >
            <input
              type="number"
              value={internalPort}
              onChange={e => setInternalPort(e.target.value)}
              placeholder="Auto-detected from image (e.g. 3306, 80, 5432, 6379)"
              className="saas-input"
              style={{ fontFamily: "monospace", fontSize: 12.5 }}
            />
          </Field>
        </Section>

        {saveError && (
          <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#f87171", fontSize: 13, marginBottom: 16 }}>
            {saveError}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <button type="submit" disabled={saving} className="btn-solid-white" style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600 }}>
            {saving ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            <span>{saving ? "Saving..." : saved ? "Changes Saved!" : "Save All Changes"}</span>
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="saas-card" style={{ padding: 0, overflow: "hidden", borderColor: "rgba(239, 68, 68, 0.25)", width: "100%" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.06)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f87171" }}>Danger Zone</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Irreversible and destructive server actions</p>
        </div>

        <div style={{ padding: 20 }}>
          {!showReinstall ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h4 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Reinstall Instance</h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Wipes server storage and downloads a clean copy of the initial software and starter templates.
                </p>
              </div>
              <button onClick={() => setShowReinstall(true)} className="btn-danger-dark">
                Reinstall Instance
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
                Type <strong style={{ color: "#ffffff" }}>{server.name}</strong> to confirm reinstall:
              </p>
              <input
                value={reinstallConfirm}
                onChange={e => setReinstallConfirm(e.target.value)}
                placeholder={server.name}
                className="saas-input"
                style={{ borderColor: "rgba(239,68,68,0.3)" }}
              />
              {reinstallError && <p style={{ fontSize: 12, color: "#f87171" }}>{reinstallError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowReinstall(false); setReinstallConfirm(""); setReinstallError(""); }} className="btn-secondary-dark">
                  Cancel
                </button>
                <button
                  onClick={handleReinstall}
                  disabled={reinstallConfirm !== server.name || reinstalling}
                  className="btn-danger-dark"
                >
                  {reinstalling && <Loader2 size={13} className="spin" />}
                  <span>{reinstalling ? "Reinstalling..." : "Confirm Reinstall"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
