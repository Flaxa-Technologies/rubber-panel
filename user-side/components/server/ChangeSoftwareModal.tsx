"use client";

import { useState, useEffect } from "react";
import {
  X, Check, Search, Loader2, Sparkles, AlertCircle,
  ExternalLink, Layers, ArrowRight, ShieldCheck, Flame, RefreshCw
} from "lucide-react";
import { SOFTWARE_CATALOG, SoftwareCatalogItem, getSoftwareLogo } from "@/lib/software-catalog";
import type { UserServer } from "@/lib/types";

interface ChangeSoftwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: UserServer;
  onSuccess: () => void;
  onTriggerReinstallWithSoftware?: (softwareType: string, version: string) => void;
}

export default function ChangeSoftwareModal({
  isOpen,
  onClose,
  server,
  onSuccess,
  onTriggerReinstallWithSoftware,
}: ChangeSoftwareModalProps) {
  const [search, setSearch] = useState("");
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareCatalogItem | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [liveSoftware, setLiveSoftware] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
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

    // Detect current software once when modal opens
    const currentType = server.software?.type || (server.serverType === "PUMPKIN" ? "PUMPKIN" : "PAPER");
    const found = SOFTWARE_CATALOG.find(s => s.type === currentType) || SOFTWARE_CATALOG[0];
    setSelectedSoftware(found);

    const currentVer = server.softwareVersion?.version || found.defaultVersions[0];
    setSelectedVersion(currentVer);

    // Fetch database software list if available
    async function loadSoftwareList() {
      setLoadingList(true);
      try {
        const res = await fetch("/api/user/software");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.software)) {
            setLiveSoftware(data.software);
          }
        }
      } catch {}
      setLoadingList(false);
    }
    loadSoftwareList();
  }, [isOpen]); // Only run when modal opens/closes, NOT on background server polling

  if (!isOpen) return null;

  // Filter items
  const filteredCatalog = SOFTWARE_CATALOG.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.type.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  );

  // Determine versions list for selected software
  const liveMatch = liveSoftware.find(s => s.type === selectedSoftware?.type || s.name.toUpperCase() === selectedSoftware?.name.toUpperCase());
  const availableVersions: string[] = (liveMatch?.versions && liveMatch.versions.length > 0)
    ? liveMatch.versions.map((v: any) => v.version || v)
    : (selectedSoftware?.defaultVersions || ["1.21.4", "1.21.1", "1.20.4"]);

  async function handleApply(reinstall: boolean = false) {
    if (!selectedSoftware) return;
    setSaving(true);
    setError("");

    try {
      // Find matching software in database
      const dbSoft = liveSoftware.find(s => s.type === selectedSoftware.type || s.name.toUpperCase() === selectedSoftware.name.toUpperCase());
      const dbVer = dbSoft?.versions?.find((v: any) => (v.version || v) === selectedVersion);

      const payload: any = {
        softwareId: dbSoft?.id || selectedSoftware.type,
        softwareType: selectedSoftware.type,
        softwareName: selectedSoftware.name,
        softwareVersionId: dbVer?.id,
        version: selectedVersion,
      };

      const res = await fetch(`/api/user/servers/${server.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to update server software.");
        setSaving(false);
        return;
      }

      setSuccessMsg(`Switched to ${selectedSoftware.name} ${selectedVersion}!`);
      setTimeout(() => {
        onSuccess();
        if (reinstall && onTriggerReinstallWithSoftware) {
          onClose();
          onTriggerReinstallWithSoftware(selectedSoftware.type, selectedVersion);
        } else {
          onClose();
        }
      }, 700);
    } catch {
      setError("Network error communicating with server.");
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
          maxWidth: 920,
          maxHeight: "92vh",
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
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                Change Server Software &amp; Version
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Switch between Paper, Purpur, Pumpkin Rust, Fabric, Forge, and more.
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

        {/* Content Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1,
          }}
        >
          {/* Search bar */}
          <div
            style={{
              position: "relative",
              width: "100%",
            }}
          >
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
              placeholder="Search software (Paper, Purpur, Pumpkin, Fabric, Spigot)..."
              className="saas-input"
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>

          {/* Software Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 12,
            }}
          >
            {filteredCatalog.map((sw) => {
              const isSelected = selectedSoftware?.id === sw.id;
              return (
                <div
                  key={sw.id}
                  onClick={() => {
                    setSelectedSoftware(sw);
                    // Reset version to first default if not matching
                    if (!sw.defaultVersions.includes(selectedVersion)) {
                      setSelectedVersion(sw.defaultVersions[0] || "1.21.4");
                    }
                  }}
                  style={{
                    padding: 14,
                    borderRadius: 12,
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
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <img
                        src={sw.logo}
                        alt={sw.name}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          objectFit: "contain",
                          backgroundColor: "rgba(0,0,0,0.3)",
                          padding: 2,
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          // Fallback icon
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sw.name}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            backgroundColor: `${sw.tagColor}20`,
                            color: sw.tagColor,
                            display: "inline-block",
                            marginTop: 2,
                          }}
                        >
                          {sw.tag}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          backgroundColor: "#38bdf8",
                          color: "#000000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={13} strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted)",
                      margin: 0,
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {sw.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Selected Software Config & Version Selector */}
          {selectedSoftware && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src={selectedSoftware.logo}
                    alt={selectedSoftware.name}
                    style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }}
                  />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                      {selectedSoftware.name} Configuration
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
                      Type: <code>{selectedSoftware.type}</code>
                    </span>
                  </div>
                </div>

                {/* Version Picker */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Select Version:
                  </label>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="saas-input"
                    style={{ minWidth: 140, padding: "6px 12px", fontSize: 12.5 }}
                  >
                    {availableVersions.map((v) => (
                      <option key={v} value={v}>
                        {v} {v === availableVersions[0] ? "(Latest)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Feature bullets */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedSoftware.features.map((feat) => (
                  <span
                    key={feat}
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    ✓ {feat}
                  </span>
                ))}
              </div>
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

        {/* Footer Actions */}
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
          <p style={{ fontSize: 11.5, color: "var(--text-dim)", margin: 0 }}>
            *Switching software changes server engine. Reinstallation is recommended if switching between incompatible engines.
          </p>

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
              disabled={saving || !selectedSoftware}
              className="btn btn-primary"
              style={{ fontSize: 12.5, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}
            >
              {saving ? <Loader2 size={13} className="spin" /> : <Check size={14} />}
              <span>Save &amp; Switch Software</span>
            </button>

            <button
              onClick={() => handleApply(true)}
              disabled={saving || !selectedSoftware}
              className="btn-danger-dark"
              style={{ fontSize: 12.5, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}
              title="Switch software and choose files to preserve (world, plugins, etc.)"
            >
              <RefreshCw size={13} />
              <span>Switch &amp; Reinstall...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
