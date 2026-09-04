"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useServer } from "@/components/server/ServerContext";
import {
  Sliders, Save, RefreshCw, Check, AlertCircle, Loader2,
  CheckCircle2, FileCode, Sparkles, Globe, Shield, Swords,
  Gamepad2, Compass, Layers, Flame, Code
} from "lucide-react";

export default function ServerPropertiesPage() {
  const { id } = useParams<{ id: string }>();
  const { server } = useServer();

  const isServerPumpkinInit = server?.serverType === "PUMPKIN" || server?.software?.type === "PUMPKIN" || server?.software?.name?.toLowerCase().includes("pumpkin");

  const [isPumpkin, setIsPumpkin] = useState(isServerPumpkinInit);
  const [configFile, setConfigFile] = useState(isServerPumpkinInit ? "pumpkin.toml" : "server.properties");
  const [mode, setMode] = useState<"gui" | "raw">("gui");
  const [props, setProps] = useState<Record<string, string>>({});
  const [rawContent, setRawContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProperties() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${id}/properties`);
      if (res.ok) {
        const data = await res.json();
        setProps(data.properties || {});
        setRawContent(data.raw || "");
        if (data.isPumpkin !== undefined) {
          setIsPumpkin(Boolean(data.isPumpkin));
        }
        if (data.configFile) {
          setConfigFile(data.configFile);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to read configuration.");
      }
    } catch {
      setError("Network error connecting to properties API.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProperties();
  }, [id]);

  function updateProp(key: string, value: string) {
    setProps(prev => ({ ...prev, [key]: value }));
  }

  function updatePropBool(key: string, value: boolean) {
    setProps(prev => ({ ...prev, [key]: value ? "true" : "false" }));
  }

  // TOML helper to update root or section keys in pumpkin.toml
  function updateTomlValue(key: string, value: string | boolean | number, section?: string) {
    setRawContent(prev => {
      let content = prev;
      const valStr = typeof value === "string" ? `"${value}"` : String(value);

      if (section) {
        const secRegex = new RegExp(`(\\[${section.replace(/\./g, "\\.")}\\][\\s\\S]*?)(?=\\n\\[|$)`);
        if (secRegex.test(content)) {
          return content.replace(secRegex, (fullSec) => {
            const keyRegex = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`, "m");
            if (keyRegex.test(fullSec)) {
              return fullSec.replace(keyRegex, `$1${valStr}`);
            } else {
              return fullSec.trimEnd() + `\n${key} = ${valStr}\n`;
            }
          });
        } else {
          return content.trimEnd() + `\n\n[${section}]\n${key} = ${valStr}\n`;
        }
      } else {
        const keyRegex = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`, "m");
        if (keyRegex.test(content)) {
          return content.replace(keyRegex, `$1${valStr}`);
        } else {
          return `${key} = ${valStr}\n` + content;
        }
      }
    });
  }

  function getTomlValue(key: string, fallback: string, section?: string): string {
    if (!rawContent) return fallback;
    let block = rawContent;
    if (section) {
      const secRegex = new RegExp(`\\[${section.replace(/\./g, "\\.")}\\]([\\s\\S]*?)(?=\\n\\[|$)`);
      const m = rawContent.match(secRegex);
      if (m) block = m[1];
    }
    const keyRegex = new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n\\r]+)"?`, "m");
    const m = block.match(keyRegex);
    return m ? m[1].trim() : fallback;
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const payload = isPumpkin || mode === "raw"
        ? { raw: rawContent, isPumpkin, configFile }
        : { properties: props, isPumpkin, configFile };

      const res = await fetch(`/api/user/servers/${id}/properties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.properties) setProps(data.properties);
        if (data.raw) setRawContent(data.raw);
        setSuccess("Configuration saved successfully! Restart the server to apply changes.");
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(data.error || "Failed to save configuration.");
      }
    } catch {
      setError("Network error saving configuration.");
    }
    setSaving(false);
  }

  if (server?.serverType === "NODEJS" || server?.software?.type === "NODEJS") {
    return (
      <div className="saas-card" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", marginBottom: 16 }}>
          <Sliders size={22} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Properties Configuration Not Applicable</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 440, lineHeight: 1.5 }}>
          This server is running the <strong>Node.js</strong> runtime environment. The properties editor is exclusive to Minecraft game servers.
        </p>
        <Link href={`/servers/${id}/files`} className="btn-solid-white" style={{ marginTop: 16, padding: "8px 16px", fontSize: 12.5, textDecoration: "none" }}>
          Open File Manager &amp; Config Files
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Header */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isPumpkin ? (
              <Flame size={20} style={{ color: "#f97316" }} />
            ) : (
              <Sliders size={18} style={{ color: "var(--text-pure)" }} />
            )}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              {isPumpkin ? "Pumpkin Configuration (pumpkin.toml)" : "Server Properties Configuration (server.properties)"}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 4,
                  backgroundColor: isPumpkin ? "rgba(249, 115, 22, 0.15)" : "rgba(56, 189, 248, 0.15)",
                  color: isPumpkin ? "#f97316" : "#38bdf8",
                  border: `1px solid ${isPumpkin ? "rgba(249, 115, 22, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
                }}
              >
                {isPumpkin ? "PUMPKIN RUST" : "JAVA MINECRAFT"}
              </span>
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, margin: 0 }}>
            {isPumpkin
              ? "Fine-tune Pumpkin's Rust multithreaded engine, Java & Bedrock networking, TPS, and world rules."
              : "Fine-tune Minecraft gameplay, world rules, networking, and player limits via GUI or raw editor."}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mode Switcher */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-surface-elevated)", padding: 3, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setMode("gui")}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: mode === "gui" ? "#ffffff" : "transparent",
                color: mode === "gui" ? "#000000" : "var(--text-muted)",
                fontWeight: mode === "gui" ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Sliders size={13} />
              <span>GUI Form</span>
            </button>

            <button
              onClick={() => setMode("raw")}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: mode === "raw" ? "#ffffff" : "transparent",
                color: mode === "raw" ? "#000000" : "var(--text-muted)",
                fontWeight: mode === "raw" ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <FileCode size={13} />
              <span>Raw Editor</span>
            </button>
          </div>

          <button
            onClick={loadProperties}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: "7px 12px", fontSize: 12 }}
            title="Reload from disk"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn btn-primary"
            style={{ padding: "7px 16px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}
          >
            {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            <span>{saving ? "Saving..." : "Save Configuration"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.25)", borderRadius: "var(--radius-md)", color: "#4ade80", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "var(--radius-md)", color: "#f87171", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="saas-card" style={{ padding: "60px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--text-muted)" }}>
          <Loader2 size={24} className="spin" />
          <span style={{ fontSize: 13 }}>Reading {configFile}...</span>
        </div>
      ) : mode === "raw" ? (
        /* Raw Editor Mode */
        <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
              {configFile} ({rawContent.split("\n").length} lines)
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Changes are saved directly to this file
            </span>
          </div>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            style={{
              width: "100%",
              height: 520,
              background: "#0c0d12",
              border: "none",
              color: "#e2e8f0",
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: 12.5,
              lineHeight: 1.6,
              padding: 16,
              resize: "vertical",
              outline: "none",
            }}
            spellCheck={false}
          />
        </div>
      ) : isPumpkin ? (
        /* ======================== PUMPKIN GUI MODE ======================== */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. Networking & Crossplay */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Globe size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)", margin: 0 }}>
                Networking &amp; Crossplay (Java + Bedrock)
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
              {/* Java MOTD */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Server MOTD (Server List Message)
                </label>
                <input
                  type="text"
                  value={getTomlValue("motd", "A blazingly fast Pumpkin server powered by Rubber Panel!", "networking.java")}
                  onChange={(e) => {
                    updateTomlValue("motd", e.target.value, "networking.java");
                    updateTomlValue("motd", e.target.value, "networking.bedrock");
                  }}
                  className="saas-input"
                />
              </div>

              {/* Max Players */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Max Players
                </label>
                <input
                  type="number"
                  value={getTomlValue("max_players", "1000", "networking.java")}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1000;
                    updateTomlValue("max_players", num, "networking.java");
                    updateTomlValue("max_players", num, "networking.bedrock");
                  }}
                  className="saas-input"
                />
              </div>

              {/* View Distance */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  View Distance (Chunks)
                </label>
                <input
                  type="number"
                  value={getTomlValue("view_distance", "16", "networking.java")}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 16;
                    updateTomlValue("view_distance", num, "networking.java");
                    updateTomlValue("view_distance", num, "networking.bedrock");
                  }}
                  className="saas-input"
                />
              </div>

              {/* Simulation Distance */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Simulation Distance
                </label>
                <input
                  type="number"
                  value={getTomlValue("simulation_distance", "10", "networking.java")}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 10;
                    updateTomlValue("simulation_distance", num, "networking.java");
                    updateTomlValue("simulation_distance", num, "networking.bedrock");
                  }}
                  className="saas-input"
                />
              </div>

              {/* Online Mode */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={getTomlValue("online_mode", "false", "networking.java") === "true"}
                  onChange={(e) => {
                    updateTomlValue("online_mode", e.target.checked, "networking.java");
                    updateTomlValue("online_mode", e.target.checked, "networking.bedrock");
                  }}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Online Mode (Mojang Auth)</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>
                    Requires verified Microsoft / Xbox accounts
                  </span>
                </div>
              </label>

              {/* Bedrock Enabled */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={getTomlValue("enabled", "true", "networking.bedrock") === "true"}
                  onChange={(e) => updateTomlValue("enabled", e.target.checked, "networking.bedrock")}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Bedrock Protocol Support</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>
                    Allow mobile, Windows 10/11, and console connections
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 2. World & Game Mechanics */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Gamepad2 size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)", margin: 0 }}>
                World Rules &amp; Simulation Engine
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
              {/* Difficulty */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Default Difficulty
                </label>
                <select
                  value={getTomlValue("default_difficulty", "Normal")}
                  onChange={(e) => updateTomlValue("default_difficulty", e.target.value)}
                  className="saas-input"
                >
                  <option value="Peaceful">Peaceful</option>
                  <option value="Easy">Easy</option>
                  <option value="Normal">Normal</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {/* Gamemode */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Default Gamemode
                </label>
                <select
                  value={getTomlValue("default_gamemode", "Survival")}
                  onChange={(e) => updateTomlValue("default_gamemode", e.target.value)}
                  className="saas-input"
                >
                  <option value="Survival">Survival</option>
                  <option value="Creative">Creative</option>
                  <option value="Adventure">Adventure</option>
                  <option value="Spectator">Spectator</option>
                </select>
              </div>

              {/* Target TPS */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Target Server Tick Rate (TPS)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={getTomlValue("tps", "20.0")}
                  onChange={(e) => updateTomlValue("tps", parseFloat(e.target.value) || 20.0)}
                  className="saas-input"
                />
              </div>

              {/* Seed */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  World Seed
                </label>
                <input
                  type="text"
                  value={getTomlValue("seed", "1789633435863525713")}
                  onChange={(e) => updateTomlValue("seed", e.target.value)}
                  className="saas-input"
                />
              </div>

              {/* Toggles */}
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={getTomlValue("allow_nether", "true") === "true"}
                    onChange={(e) => updateTomlValue("allow_nether", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Allow The Nether</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={getTomlValue("allow_end", "true") === "true"}
                    onChange={(e) => updateTomlValue("allow_end", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Allow The End</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={getTomlValue("hardcore", "false") === "true"}
                    onChange={(e) => updateTomlValue("hardcore", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Hardcore Mode</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={getTomlValue("enabled", "true", "pvp") === "true"}
                    onChange={(e) => updateTomlValue("enabled", e.target.checked, "pvp")}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Player vs Player (PvP)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== STANDARD MINECRAFT GUI MODE ==================== */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. General & Server Identity */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Globe size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                General &amp; Server Identity
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Server MOTD (Server List Message)
                </label>
                <input
                  type="text"
                  value={props["motd"] ?? ""}
                  onChange={(e) => updateProp("motd", e.target.value)}
                  placeholder="A Minecraft Server"
                  className="saas-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Max Players
                </label>
                <input
                  type="number"
                  value={props["max-players"] ?? "20"}
                  onChange={(e) => updateProp("max-players", e.target.value)}
                  className="saas-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Server Port (Default: 25565)
                </label>
                <input
                  type="number"
                  value={props["server-port"] ?? "25565"}
                  onChange={(e) => updateProp("server-port", e.target.value)}
                  className="saas-input"
                />
              </div>
            </div>
          </div>

          {/* 2. Gameplay & Difficulty */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Swords size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                Gameplay &amp; Difficulty
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Gamemode
                </label>
                <select
                  value={props["gamemode"] ?? "survival"}
                  onChange={(e) => updateProp("gamemode", e.target.value)}
                  className="saas-input"
                >
                  <option value="survival">Survival</option>
                  <option value="creative">Creative</option>
                  <option value="adventure">Adventure</option>
                  <option value="spectator">Spectator</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Difficulty
                </label>
                <select
                  value={props["difficulty"] ?? "easy"}
                  onChange={(e) => updateProp("difficulty", e.target.value)}
                  className="saas-input"
                >
                  <option value="peaceful">Peaceful</option>
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  View Distance (Chunks)
                </label>
                <input
                  type="number"
                  value={props["view-distance"] ?? "10"}
                  onChange={(e) => updateProp("view-distance", e.target.value)}
                  className="saas-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Simulation Distance
                </label>
                <input
                  type="number"
                  value={props["simulation-distance"] ?? "8"}
                  onChange={(e) => updateProp("simulation-distance", e.target.value)}
                  className="saas-input"
                />
              </div>

              {/* Toggles */}
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["pvp"] === "true" || props["pvp"] === undefined}
                    onChange={(e) => updatePropBool("pvp", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Enable PvP</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["hardcore"] === "true"}
                    onChange={(e) => updatePropBool("hardcore", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Hardcore Mode</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["allow-flight"] === "true"}
                    onChange={(e) => updatePropBool("allow-flight", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Allow Flight</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. World Generation */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Compass size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                World Generation
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  World Name
                </label>
                <input
                  type="text"
                  value={props["level-name"] ?? "world"}
                  onChange={(e) => updateProp("level-name", e.target.value)}
                  className="saas-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  World Seed (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Random if empty"
                  value={props["level-seed"] ?? ""}
                  onChange={(e) => updateProp("level-seed", e.target.value)}
                  className="saas-input"
                />
              </div>

              {/* Toggles */}
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["generate-structures"] === "true" || props["generate-structures"] === undefined}
                    onChange={(e) => updatePropBool("generate-structures", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Generate Structures</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["allow-nether"] === "true" || props["allow-nether"] === undefined}
                    onChange={(e) => updatePropBool("allow-nether", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Allow The Nether</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["spawn-monsters"] === "true" || props["spawn-monsters"] === undefined}
                    onChange={(e) => updatePropBool("spawn-monsters", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Spawn Monsters</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["spawn-animals"] === "true" || props["spawn-animals"] === undefined}
                    onChange={(e) => updatePropBool("spawn-animals", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Spawn Animals</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["spawn-npcs"] === "true" || props["spawn-npcs"] === undefined}
                    onChange={(e) => updatePropBool("spawn-npcs", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Spawn Villagers (NPCs)</span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. Security & Network */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Shield size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                Security &amp; Network
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
              {/* Online Mode */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={props["online-mode"] === "true"}
                  onChange={(e) => updatePropBool("online-mode", e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Online Mode</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>
                    {props["online-mode"] === "true" ? "Mojang Auth Required" : "Cracked Allowed"}
                  </span>
                </div>
              </label>

              {/* Whitelist */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={props["white-list"] === "true"}
                  onChange={(e) => updatePropBool("white-list", e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Enable Whitelist</span>
              </label>

              {/* Command Blocks */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={props["enable-command-block"] === "true"}
                  onChange={(e) => updatePropBool("enable-command-block", e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Enable Command Blocks</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
