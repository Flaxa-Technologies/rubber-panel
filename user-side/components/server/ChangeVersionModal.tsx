"use client";

import { useState, useEffect } from "react";
import {
  X, Check, Search, Loader2, Sparkles, AlertCircle,
  Tag, RefreshCw, Layers, CheckCircle2, ArrowRight
} from "lucide-react";
import { SOFTWARE_CATALOG, getSoftwareLogo } from "@/lib/software-catalog";
import type { UserServer } from "@/lib/types";

interface ChangeVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: UserServer;
  onSuccess: () => void;
  onTriggerReinstallWithVersion?: (version: string) => void;
}

const NODEJS_VERSIONS = ["22", "20", "18", "23"];

export default function ChangeVersionModal({
  isOpen,
  onClose,
  server,
  onSuccess,
  onTriggerReinstallWithVersion,
}: ChangeVersionModalProps) {
  const isPumpkin = server.serverType === "PUMPKIN" || server.software?.type === "PUMPKIN" || server.software?.name?.toLowerCase().includes("pumpkin");
  const isNodeJs = server.serverType === "NODEJS" || server.software?.type === "NODEJS";

  const softwareType = isPumpkin ? "PUMPKIN" : (server.software?.type || server.serverType || "PAPER");
  const softwareName = isPumpkin
    ? "Pumpkin MC (Rust)"
    : (server.software?.name || (isNodeJs ? "Node.js" : "Minecraft Paper"));

  const catalogEntry = SOFTWARE_CATALOG.find(
    s => s.type === softwareType.toUpperCase() || s.id === softwareType.toLowerCase()
  );

  const softwareLogo = isPumpkin
    ? "https://pumpkinmc.org/assets/icon.svg"
    : getSoftwareLogo(softwareType);

  const currentInstalledVersion = isPumpkin
    ? "Nightly"
    : (server.softwareVersion?.version || (isNodeJs ? (server.nodeVersion || "20") : "1.21.4"));

  const [search, setSearch] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<string>(currentInstalledVersion);
  const [liveVersions, setLiveVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setError("");
      setSuccessMsg("");
      return;
    }

    const cur = isPumpkin
      ? "Nightly"
      : (server.softwareVersion?.version || (isNodeJs ? (server.nodeVersion || "20") : "1.21.4"));
    setSelectedVersion(cur);

    if (isNodeJs) {
      setLiveVersions(NODEJS_VERSIONS.map(v => ({ version: v, isStable: v === "22" || v === "20" })));
      return;
    }

    async function loadVersions() {
      setLoading(true);
      try {
        const res = await fetch("/api/user/software");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.software)) {
            const foundSoft = data.software.find(
              (s: any) => s.type === softwareType || s.name?.toUpperCase() === softwareName.toUpperCase()
            );
            if (foundSoft && Array.isArray(foundSoft.versions) && foundSoft.versions.length > 0) {
              setLiveVersions(foundSoft.versions);
              return;
            }
          }
        }
      } catch {}

      // Fallback to catalog defaults
      const defaults = isPumpkin
        ? ["Nightly (Latest)", "0.1.0"]
        : (catalogEntry?.defaultVersions || ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.19.4", "1.18.2"]);

      setLiveVersions(defaults.map((v, idx) => ({ version: v, isStable: idx > 0 })));
      setLoading(false);
    }

    loadVersions();
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract version strings
  const versionItems: { version: string; isStable?: boolean; date?: string; id?: string }[] = liveVersions.map((v) => {
    if (typeof v === "string") return { version: v, isStable: true };
    return {
      version: v.version || String(v),
      isStable: v.isStable !== false,
      date: v.releaseDate ? new Date(v.releaseDate).toLocaleDateString() : undefined,
      id: v.id,
    };
  });

  const filteredVersions = versionItems.filter(v =>
    v.version.toLowerCase().includes(search.toLowerCase())
  );

  async function handleApply(reinstall: boolean = false) {
    if (!selectedVersion) return;
    setSaving(true);
    setError("");

    try {
      const matchingDbVer = liveVersions.find((v: any) => (v.version || v) === selectedVersion);
      const payload: any = {
        version: selectedVersion,
        softwareVersionId: matchingDbVer?.id,
      };

      if (isNodeJs) {
        payload.nodeVersion = selectedVersion;
      }

      const res = await fetch(`/api/user/servers/${server.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to update server version.");
        setSaving(false);
        return;
      }

      setSuccessMsg(`Switched to version ${selectedVersion}!`);
      setTimeout(() => {
        onSuccess();
        if (reinstall && onTriggerReinstallWithVersion) {
          onClose();
          onTriggerReinstallWithVersion(selectedVersion);
        } else {
          onClose();
        }
      }, 700);
    } catch {
      setError("Network error updating server version.");
    }
    setSaving(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
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
          maxHeight: "90vh",
          backgroundColor: "#0d0f17",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={softwareLogo}
              alt={softwareName}
              style={{
                width: 38,
                height: 38,
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
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                  Change {softwareName} Version
                </h2>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  Current: v{currentInstalledVersion}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Switch or upgrade Minecraft version without altering server software engine.
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

        {/* Body Content */}
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
          {/* Search bar */}
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-dim)",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filter ${softwareName} versions (e.g. 1.21.4, 1.20, Nightly)...`}
              className="saas-input"
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
              <Loader2 size={16} className="spin" />
              <span>Fetching versions list...</span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 10,
                maxHeight: "44vh",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {filteredVersions.map((vItem, idx) => {
                const isSelected = selectedVersion === vItem.version;
                const isCurrent = currentInstalledVersion === vItem.version;
                const isLatest = idx === 0;

                return (
                  <div
                    key={vItem.version}
                    onClick={() => setSelectedVersion(vItem.version)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: isSelected
                        ? "1.5px solid #38bdf8"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      backgroundColor: isSelected
                        ? "rgba(56, 189, 248, 0.08)"
                        : "rgba(255, 255, 255, 0.02)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Tag size={12} style={{ color: isSelected ? "#38bdf8" : "var(--text-dim)" }} />
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? "#38bdf8" : "#ffffff", fontFamily: "monospace" }}>
                          {vItem.version}
                        </span>
                      </div>

                      {isSelected ? (
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            backgroundColor: "#38bdf8",
                            color: "#000000",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={11} strokeWidth={3} />
                        </div>
                      ) : isCurrent ? (
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)" }}>
                          INSTALLED
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {isLatest && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(34, 197, 94, 0.15)", color: "#4ade80" }}>
                          LATEST
                        </span>
                      )}
                      {isCurrent && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                          CURRENT
                        </span>
                      )}
                      {vItem.isStable && !isLatest && (
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-dim)" }}>
                          Stable
                        </span>
                      )}
                      {vItem.date && (
                        <span style={{ fontSize: 9.5, color: "var(--text-dim)", marginLeft: "auto" }}>
                          {vItem.date}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

          {successMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                borderRadius: 8,
                color: "#4ade80",
                fontSize: 12.5,
              }}
            >
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Target Version:</span>
            <strong style={{ fontSize: 13, color: "#ffffff", fontFamily: "monospace" }}>
              {selectedVersion || "None selected"}
            </strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: 12.5, padding: "8px 16px" }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              onClick={() => handleApply(false)}
              disabled={saving || !selectedVersion}
              className="btn btn-primary"
              style={{ fontSize: 12.5, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}
            >
              {saving ? <Loader2 size={13} className="spin" /> : <Check size={14} />}
              <span>Switch Version</span>
            </button>

            <button
              onClick={() => handleApply(true)}
              disabled={saving || !selectedVersion}
              className="btn-danger-dark"
              style={{ fontSize: 12.5, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}
              title="Update version and choose files to preserve during fresh reinstall"
            >
              <RefreshCw size={13} />
              <span>Update &amp; Reinstall...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
