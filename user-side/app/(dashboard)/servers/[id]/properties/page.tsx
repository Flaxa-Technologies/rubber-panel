"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useServer } from "@/components/server/ServerContext";
import {
  Sliders, Save, RefreshCw, Check, AlertCircle, Loader2,
  CheckCircle2, FileCode, Sparkles, Globe, Shield, Swords,
  Gamepad2, Compass, Layers
} from "lucide-react";

export default function ServerPropertiesPage() {
  const { id } = useParams<{ id: string }>();
  const { server } = useServer();

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
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to read server.properties.");
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

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const payload = mode === "raw" ? { raw: rawContent } : { properties: props };
      const res = await fetch(`/api/user/servers/${id}/properties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setProps(data.properties || {});
        setRawContent(data.raw || "");
        setSuccess("Properties saved successfully! Restart the server to apply changes.");
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(data.error || "Failed to save properties.");
      }
    } catch {
      setError("Network error saving properties.");
    }
    setSaving(false);
  }

  if (server?.serverType === "NODEJS") {
    return (
      <div className="saas-card" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", marginBottom: 16 }}>
          <Sliders size={22} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Properties Configuration Not Applicable</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 440, lineHeight: 1.5 }}>
          This server is configured with the <strong>Node.js</strong> runtime environment. The <code>server.properties</code> file is exclusive to Minecraft game servers.
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
            <Sliders size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              Server Properties Configuration
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Fine-tune Minecraft gameplay, world rules, networking, and player limits via GUI or raw editor.
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
              }}
            >
              GUI Editor
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
              }}
            >
              Raw File
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn-solid-white"
            style={{ padding: "7px 16px", fontSize: 12.5 }}
          >
            {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            <span>{saving ? "Saving..." : "Save Properties"}</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-sm)", color: "#34d399", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="saas-card" style={{ padding: 60, textAlign: "center" }}>
          <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px", color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading server.properties...</span>
        </div>
      ) : mode === "raw" ? (
        /* RAW EDITOR */
        <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
              /server.properties
            </span>
          </div>
          <textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            style={{
              width: "100%",
              height: 480,
              padding: 16,
              background: "var(--bg-app)",
              color: "var(--text-primary)",
              border: "none",
              outline: "none",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : (
        /* CATEGORIZED GUI EDITOR */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. General & Server Identity */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Compass size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                General &amp; Server Identity
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
              {/* MOTD */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Server Message of the Day (MOTD)
                </label>
                <input
                  type="text"
                  value={props["motd"] ?? "A Minecraft Server powered by Rubber Panel"}
                  onChange={(e) => updateProp("motd", e.target.value)}
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
                  min="1"
                  max="1000"
                  value={props["max-players"] ?? "20"}
                  onChange={(e) => updateProp("max-players", e.target.value)}
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
                  min="3"
                  max="32"
                  value={props["view-distance"] ?? "10"}
                  onChange={(e) => updateProp("view-distance", e.target.value)}
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
                  min="3"
                  max="32"
                  value={props["simulation-distance"] ?? "8"}
                  onChange={(e) => updateProp("simulation-distance", e.target.value)}
                  className="saas-input"
                />
              </div>
            </div>
          </div>

          {/* 2. Gameplay & Rules */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Gamepad2 size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                Gameplay &amp; Difficulty Rules
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
              {/* Gamemode */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Default Gamemode
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

              {/* Difficulty */}
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

              {/* Toggles Grid */}
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
                {/* PVP */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["pvp"] === "true" || props["pvp"] === undefined}
                    onChange={(e) => updatePropBool("pvp", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Allow PVP Combat</span>
                </label>

                {/* Hardcore */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["hardcore"] === "true"}
                    onChange={(e) => updatePropBool("hardcore", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Hardcore Mode</span>
                </label>

                {/* Flight */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["allow-flight"] === "true"}
                    onChange={(e) => updatePropBool("allow-flight", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Allow Flight</span>
                </label>

                {/* Force Gamemode */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props["force-gamemode"] === "true"}
                    onChange={(e) => updatePropBool("force-gamemode", e.target.checked)}
                    style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Force Gamemode on Join</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. World Generation & Spawns */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
              <Globe size={16} style={{ color: "var(--text-pure)" }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                World Generation &amp; Spawns
              </h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14 }}>
              {/* Level Name */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  World Folder Name
                </label>
                <input
                  type="text"
                  value={props["level-name"] ?? "world"}
                  onChange={(e) => updateProp("level-name", e.target.value)}
                  className="saas-input"
                />
              </div>

              {/* Level Seed */}
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
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
