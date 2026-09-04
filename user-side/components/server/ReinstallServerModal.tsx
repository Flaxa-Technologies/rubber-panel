"use client";

import { useState } from "react";
import {
  AlertTriangle, Check, X, Folder, FileText, Loader2,
  RefreshCw, ShieldAlert, CheckCircle2, Flame, Sparkles
} from "lucide-react";
import type { UserServer } from "@/lib/types";

interface ReinstallServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: UserServer;
  onSuccess: () => void;
  customSoftwareType?: string;
  customVersion?: string;
}

const COMMON_PRESERVES = [
  { id: "world", label: "world / World Saves", description: "Your main Overworld save directory", default: true },
  { id: "world_nether", label: "world_nether", description: "Nether dimension files", default: true },
  { id: "world_the_end", label: "world_the_end", description: "The End dimension files", default: true },
  { id: "plugins", label: "plugins/", description: "All installed Bukkit / Spigot / Paper plugins", default: true },
  { id: "mods", label: "mods/", description: "Fabric / Forge / NeoForge mod files", default: false },
  { id: "config", label: "config/", description: "Plugin, mod, and system configuration files", default: true },
  { id: "server.properties", label: "server.properties", description: "Minecraft server properties file", default: true },
  { id: "pumpkin.toml", label: "pumpkin.toml", description: "Pumpkin Rust server configuration", default: true },
  { id: ".env", label: ".env", description: "Server environment variables file", default: true },
];

export default function ReinstallServerModal({
  isOpen,
  onClose,
  server,
  onSuccess,
  customSoftwareType,
  customVersion,
}: ReinstallServerModalProps) {
  const isPumpkin = (customSoftwareType || server.software?.type || server.serverType) === "PUMPKIN";

  // Initial preserve list
  const [selectedPaths, setSelectedPaths] = useState<string[]>(() => {
    return COMMON_PRESERVES
      .filter(p => {
        if (isPumpkin && p.id === "server.properties") return false;
        if (!isPumpkin && p.id === "pumpkin.toml") return false;
        return p.default;
      })
      .map(p => p.id);
  });

  const [customPathsInput, setCustomPathsInput] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [reinstalling, setReinstalling] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const togglePath = (pathId: string) => {
    setSelectedPaths(prev =>
      prev.includes(pathId) ? prev.filter(p => p !== pathId) : [...prev, pathId]
    );
  };

  const applyPreset = (preset: "worlds_plugins" | "configs_only" | "wipe_all") => {
    if (preset === "wipe_all") {
      setSelectedPaths([]);
      setCustomPathsInput("");
    } else if (preset === "configs_only") {
      setSelectedPaths(["config", isPumpkin ? "pumpkin.toml" : "server.properties", ".env"]);
    } else if (preset === "worlds_plugins") {
      setSelectedPaths([
        "world", "world_nether", "world_the_end", "plugins", "mods", "config",
        isPumpkin ? "pumpkin.toml" : "server.properties", ".env"
      ]);
    }
  };

  async function handleExecuteReinstall() {
    if (confirmName !== server.name) return;
    setReinstalling(true);
    setError("");

    try {
      // Merge custom paths
      const customList = customPathsInput
        .split(/[,;\n]/)
        .map(p => p.trim())
        .filter(Boolean);

      const allPreserved = Array.from(new Set([...selectedPaths, ...customList]));

      const res = await fetch(`/api/user/servers/${server.id}/reinstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preservePaths: allPreserved,
          softwareType: customSoftwareType,
          softwareVersion: customVersion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reinstall server.");
        setReinstalling(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Network error while connecting to server daemon.");
    } finally {
      setReinstalling(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "92vh",
          backgroundColor: "#0e1017",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(239, 68, 68, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                Reinstall Server Instance
              </h2>
              <p style={{ fontSize: 12, color: "#fca5a5", margin: "2px 0 0 0" }}>
                Select files to preserve before resetting server storage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 6, color: "var(--text-muted)", borderRadius: 8 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
          }}
        >
          {/* Target Engine Badge */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              backgroundColor: isPumpkin ? "rgba(249, 115, 22, 0.1)" : "rgba(56, 189, 248, 0.08)",
              border: `1px solid ${isPumpkin ? "rgba(249, 115, 22, 0.3)" : "rgba(56, 189, 248, 0.25)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isPumpkin ? <Flame size={16} style={{ color: "#f97316" }} /> : <Sparkles size={16} style={{ color: "#38bdf8" }} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>
                Target Engine: {isPumpkin ? "Pumpkin MC (Rust Multithreaded)" : `${customSoftwareType || server.software?.name || "Paper"} ${customVersion || server.softwareVersion?.version || "Latest"}`}
              </span>
            </div>
            <span style={{ fontSize: 11, color: isPumpkin ? "#fed7aa" : "#bae6fd" }}>
              {isPumpkin ? "Native Linux x64/ARM64 Binary" : "Automated Jar Provisioning"}
            </span>
          </div>

          {/* Preset Quick Selection Buttons */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)" }}>
                Files &amp; Directories to Preserve (Do NOT Delete):
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => applyPreset("worlds_plugins")}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Keep Worlds &amp; Plugins
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("configs_only")}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Configs Only
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("wipe_all")}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#f87171",
                    cursor: "pointer",
                  }}
                >
                  Wipe Everything
                </button>
              </div>
            </div>

            {/* Checkbox List */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 8,
                backgroundColor: "rgba(0,0,0,0.3)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {COMMON_PRESERVES.map((item) => {
                // Filter out non-matching config
                if (isPumpkin && item.id === "server.properties") return null;
                if (!isPumpkin && item.id === "pumpkin.toml") return null;

                const isChecked = selectedPaths.includes(item.id);
                return (
                  <label
                    key={item.id}
                    onClick={() => togglePath(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      backgroundColor: isChecked ? "rgba(34, 197, 94, 0.08)" : "transparent",
                      border: isChecked ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid transparent",
                      cursor: "pointer",
                      userSelect: "none",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ marginTop: 2, accentColor: "#22c55e", cursor: "pointer" }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: isChecked ? "#ffffff" : "var(--text-secondary)" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.3 }}>
                        {item.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Custom Preserved Paths */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
              Additional Custom Files to Preserve (Comma-separated):
            </label>
            <input
              value={customPathsInput}
              onChange={(e) => setCustomPathsInput(e.target.value)}
              placeholder="e.g. whitelist.json, ops.json, logs, banned-players.json"
              className="saas-input"
              style={{ fontSize: 12.5 }}
            />
          </div>

          {/* Confirmation Input */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              backgroundColor: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p style={{ fontSize: 12.5, color: "#ffffff", margin: 0 }}>
              To confirm reinstallation, type the server name <strong style={{ color: "#f87171" }}>{server.name}</strong> below:
            </p>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={server.name}
              className="saas-input"
              style={{ borderColor: "rgba(239, 68, 68, 0.3)", fontSize: 13 }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                color: "#f87171",
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: 12.5, padding: "8px 16px" }}
            disabled={reinstalling}
          >
            Cancel
          </button>

          <button
            onClick={handleExecuteReinstall}
            disabled={confirmName !== server.name || reinstalling}
            className="btn-danger-dark"
            style={{
              fontSize: 12.5,
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: confirmName !== server.name || reinstalling ? 0.6 : 1,
              cursor: confirmName !== server.name || reinstalling ? "not-allowed" : "pointer",
            }}
          >
            {reinstalling ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            <span>{reinstalling ? "Reinstalling..." : "Confirm & Reinstall"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
