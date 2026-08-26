"use client";

import { useServer } from "@/components/server/ServerContext";
import { formatBytes } from "@/lib/server-utils";
import {
  Archive,
  Cloud,
  Plus,
  RefreshCw,
  Trash2,
  RotateCcw,
  ExternalLink,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Settings2,
  Check,
  X,
  AlertTriangle,
  Lock,
  Link as LinkIcon,
  Unlink,
  FolderArchive,
  Calendar,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface BackupItem {
  id: string;
  name: string;
  status: string;
  storageType: string;
  size: number | null;
  gdriveFileId?: string | null;
  gdriveWebUrl?: string | null;
  createdAt: string;
  excludePaths?: string | null;
}

interface BackupPolicies {
  allowGoogleDriveBackups: boolean;
  gdriveRetentionCount: number;
  gdriveAutoSchedule: string;
  gdriveExcludePaths: string[];
}

interface GDriveStatus {
  panelConfigured: boolean;
  userLinked: boolean;
  account?: {
    email: string;
    name: string;
    storageTotal: number;
    storageUsed: number;
  };
}

export default function BackupsPage() {
  const { server } = useServer();
  const searchParams = useSearchParams();

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [policies, setPolicies] = useState<BackupPolicies>({
    allowGoogleDriveBackups: true,
    gdriveRetentionCount: 3,
    gdriveAutoSchedule: "DISABLED",
    gdriveExcludePaths: [".cache", "logs", "crash-reports"],
  });
  const [gdriveStatus, setGdriveStatus] = useState<GDriveStatus>({
    panelConfigured: false,
    userLinked: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create Backup Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createStorage, setCreateStorage] = useState<"GOOGLE_DRIVE" | "LOCAL">("GOOGLE_DRIVE");
  const [createExcludes, setCreateExcludes] = useState<string[]>([".cache", "logs", "crash-reports"]);
  const [customExcludeInput, setCustomExcludeInput] = useState("");
  const [creating, setCreating] = useState(false);

  // Restore Modal State
  const [restoreBackup, setRestoreBackup] = useState<BackupItem | null>(null);
  const [wipeBeforeRestore, setWipeBeforeRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editRetention, setEditRetention] = useState(3);
  const [editSchedule, setEditSchedule] = useState("DISABLED");
  const [editExcludes, setEditExcludes] = useState<string[]>([".cache", "logs", "crash-reports"]);
  const [customSettingExclude, setCustomSettingExclude] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Action Loading
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkingGDrive, setLinkingGDrive] = useState(false);

  // Load server backups and cloud status
  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        if (data.policies) {
          setPolicies(data.policies);
          setEditRetention(data.policies.gdriveRetentionCount || 3);
          setEditSchedule(data.policies.gdriveAutoSchedule || "DISABLED");
          setEditExcludes(data.policies.gdriveExcludePaths || [".cache", "logs", "crash-reports"]);
          setCreateExcludes(data.policies.gdriveExcludePaths || [".cache", "logs", "crash-reports"]);
        }
        if (data.gdriveStatus) {
          setGdriveStatus(data.gdriveStatus);
          if (!data.gdriveStatus.userLinked) {
            setCreateStorage("LOCAL");
          } else {
            setCreateStorage("GOOGLE_DRIVE");
          }
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load backups.");
      }
    } catch {
      setError("Network error while loading backups.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    if (searchParams.get("gdrive") === "success") {
      setSuccess("Your Google Drive account has been connected successfully!");
    } else if (searchParams.get("gdrive") === "error") {
      setError(searchParams.get("message") || "Failed to connect Google Drive.");
    }
  }, [server.id]);

  // Connect Google Drive Flow
  async function handleConnectGDrive() {
    setLinkingGDrive(true);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups/gdrive/auth`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to initiate Google Drive authentication.");
        setLinkingGDrive(false);
      }
    } catch {
      setError("Network error connecting to Google.");
      setLinkingGDrive(false);
    }
  }

  // Disconnect Google Drive
  async function handleDisconnectGDrive() {
    if (!confirm("Are you sure you want to disconnect your Google Drive account from this panel?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups/gdrive/disconnect`, {
        method: "POST",
      });
      if (res.ok) {
        setSuccess("Google Drive account disconnected.");
        await loadData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to disconnect Google Drive.");
      }
    } catch {
      setError("Network error disconnecting Google Drive.");
    }
  }

  // Open Create Backup Modal
  function openCreateModal() {
    const defaultName = `snapshot-${new Date().toISOString().slice(0, 10)}-${Math.floor(1000 + Math.random() * 9000)}.zip`;
    setCreateName(defaultName);
    setCreateStorage(gdriveStatus.userLinked && policies.allowGoogleDriveBackups ? "GOOGLE_DRIVE" : "LOCAL");
    setCreateExcludes(policies.gdriveExcludePaths || [".cache", "logs", "crash-reports"]);
    setShowCreateModal(true);
    setError("");
    setSuccess("");
  }

  // Execute Create Backup
  async function handleCreateBackup() {
    if (!createName.trim()) {
      setError("Backup name cannot be empty.");
      return;
    }
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          storageType: createStorage,
          excludePaths: createExcludes,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        data = { error: text || `Server responded with status ${res.status}` };
      }

      if (res.ok) {
        setSuccess(data.message || `Backup "${createName}" created successfully!`);
        setShowCreateModal(false);
        await loadData();
      } else {
        setError(data.error || "Failed to create backup.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error while creating backup.");
    }
    setCreating(false);
  }

  // Execute Restore Snapshot
  async function handleRestoreBackup() {
    if (!restoreBackup) return;
    setRestoring(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups/${restoreBackup.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wipeBeforeRestore }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `Server successfully restored from "${restoreBackup.name}"!`);
        setRestoreBackup(null);
      } else {
        setError(data.error || "Failed to restore backup snapshot.");
      }
    } catch {
      setError("Network error while restoring snapshot.");
    }
    setRestoring(false);
  }

  // Delete Backup
  async function handleDeleteBackup(backup: BackupItem) {
    if (!confirm(`Are you sure you want to permanently delete backup "${backup.name}"?`)) return;
    setDeletingId(backup.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups/${backup.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `Backup "${backup.name}" deleted.`);
        await loadData();
      } else {
        setError(data.error || "Failed to delete backup.");
      }
    } catch {
      setError("Network error while deleting backup.");
    }
    setDeletingId(null);
  }

  // Save Settings
  async function handleSaveSettings() {
    setSavingSettings(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/backups/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gdriveRetentionCount: editRetention,
          gdriveAutoSchedule: editSchedule,
          gdriveExcludePaths: editExcludes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("Backup schedule and retention policies updated successfully!");
        setShowSettingsModal(false);
        await loadData();
      } else {
        setError(data.error || "Failed to update backup settings.");
      }
    } catch {
      setError("Network error while updating backup policies.");
    }
    setSavingSettings(false);
  }

  function toggleExclude(path: string, list: string[], setList: (l: string[]) => void) {
    if (list.includes(path)) {
      setList(list.filter((p) => p !== path));
    } else {
      setList([...list, path]);
    }
  }

  function addCustomExclude(list: string[], setList: (l: string[]) => void, inputVal: string, setInputVal: (v: string) => void) {
    if (!inputVal.trim()) return;
    const clean = inputVal.trim().replace(/^\/+/, "");
    if (!list.includes(clean)) {
      setList([...list, clean]);
    }
    setInputVal("");
  }

  const totalBytes = backups.reduce((acc, b) => acc + (b.size || 0), 0);
  const cloudCount = backups.filter((b) => b.storageType === "GOOGLE_DRIVE" || b.storageType === "BOTH").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      {/* Top Header Card */}
      <div
        className="saas-card"
        style={{
          padding: "20px 24px",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          background: "linear-gradient(135deg, rgba(24, 24, 27, 0.8) 0%, rgba(9, 9, 11, 0.95) 100%)",
          border: "1px solid var(--border-medium)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(56, 189, 248, 0.12)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(56, 189, 248, 0.15)",
            }}
          >
            <FolderArchive size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
                Server Snapshots &amp; Cloud Backups
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 9999,
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                }}
              >
                {backups.length} Snapshots ({formatBytes(totalBytes)})
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
              Continuous world protection, automated Google Drive replication, and instant 1-click restore engine.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-secondary-dark"
            style={{ padding: "8px 14px", fontSize: 12.5, borderRadius: 10, display: "flex", alignItems: "center", gap: 7 }}
          >
            <Settings2 size={14} style={{ color: "#38bdf8" }} />
            <span>Automation &amp; Retention</span>
          </button>

          <button
            onClick={openCreateModal}
            className="btn-solid-white"
            style={{ padding: "8px 16px", fontSize: 12.5, borderRadius: 10, display: "flex", alignItems: "center", gap: 7 }}
          >
            <Plus size={14} />
            <span>Take Snapshot Now</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#f87171",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#34d399",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {/* Google Drive Status & Cloud Integration Card */}
      <div
        className="saas-card"
        style={{
          padding: 20,
          borderRadius: 16,
          background: gdriveStatus.userLinked
            ? "linear-gradient(135deg, rgba(56, 189, 248, 0.06) 0%, rgba(15, 23, 42, 0.5) 100%)"
            : "linear-gradient(135deg, rgba(24, 24, 27, 0.6) 0%, rgba(9, 9, 11, 0.8) 100%)",
          border: gdriveStatus.userLinked ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid var(--border-subtle)",
          boxShadow: gdriveStatus.userLinked ? "0 0 24px rgba(56, 189, 248, 0.08)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: gdriveStatus.userLinked ? "rgba(56, 189, 248, 0.15)" : "rgba(234, 179, 8, 0.12)",
                color: gdriveStatus.userLinked ? "#38bdf8" : "#eab308",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Cloud size={22} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                  Google Drive Cloud Replication
                </span>
                {gdriveStatus.userLinked ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Check size={11} /> Connected &amp; Synced
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 9999,
                      background: "rgba(234, 179, 8, 0.12)",
                      color: "#eab308",
                      border: "1px solid rgba(234, 179, 8, 0.25)",
                    }}
                  >
                    Not Linked
                  </span>
                )}
              </div>

              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, maxWidth: 650 }}>
                {gdriveStatus.userLinked ? (
                  <span>
                    Linked account: <strong style={{ color: "#38bdf8" }}>{gdriveStatus.account?.email || "Personal Google Account"}</strong> · Automatically enforcing retention limit (max <strong>{policies.gdriveRetentionCount}</strong> snapshots; oldest auto-deleted on rotation).
                  </span>
                ) : gdriveStatus.panelConfigured ? (
                  <span>
                    Link your personal Google Drive to backup worlds to the cloud on schedule with zero server disk consumption and automated retention.
                  </span>
                ) : (
                  <span>
                    Google Drive cloud integration has not been configured by panel admin yet. Server can still create and restore local snapshots.
                  </span>
                )}
              </p>

              {/* Status pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Clock size={12} style={{ color: "var(--text-muted)" }} />
                  <span>Auto-Schedule: <strong style={{ color: "var(--text-primary)" }}>{policies.gdriveAutoSchedule === "DISABLED" ? "Off" : policies.gdriveAutoSchedule}</strong></span>
                </span>

                <span style={{ fontSize: 11.5, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Layers size={12} style={{ color: "var(--text-muted)" }} />
                  <span>Retention Limit: <strong style={{ color: "var(--text-primary)" }}>{policies.gdriveRetentionCount} Backups</strong></span>
                </span>

                <span style={{ fontSize: 11.5, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Cloud size={12} style={{ color: "#38bdf8" }} />
                  <span>Cloud Stored: <strong style={{ color: "#38bdf8" }}>{cloudCount} Snapshots</strong></span>
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "center" }}>
            {gdriveStatus.userLinked ? (
              <button
                onClick={handleDisconnectGDrive}
                className="btn-danger-dark"
                style={{ fontSize: 12, padding: "7px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Unlink size={13} />
                <span>Disconnect</span>
              </button>
            ) : gdriveStatus.panelConfigured && policies.allowGoogleDriveBackups ? (
              <button
                onClick={handleConnectGDrive}
                disabled={linkingGDrive}
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: "8px 18px",
                  borderRadius: 10,
                  background: "#38bdf8",
                  color: "#000000",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  boxShadow: "0 0 20px rgba(56, 189, 248, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                {linkingGDrive ? <Loader2 size={14} className="spin" /> : <LinkIcon size={14} />}
                <span>Connect Google Drive</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Snapshots Inventory Card */}
      <div
        className="saas-card"
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Archive size={16} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-pure)" }}>
              Stored Snapshots &amp; Restoration Points
            </span>
          </div>

          <button
            onClick={loadData}
            title="Refresh Backups"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
            }}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            <Loader2 size={24} className="spin" style={{ margin: "0 auto 10px auto", color: "#38bdf8" }} />
            <span>Loading snapshot inventory...</span>
          </div>
        ) : backups.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Archive size={36} style={{ margin: "0 auto 12px auto", color: "var(--text-dim)", opacity: 0.4 }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-pure)", marginBottom: 4 }}>No Backups Recorded</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", maxWidth: 440, margin: "0 auto 16px auto" }}>
              Take your first snapshot now to protect your world against player griefing, corrupt chunks, or plugin failures.
            </p>
            <button
              onClick={openCreateModal}
              className="btn-solid-white"
              style={{ padding: "8px 16px", fontSize: 12.5, borderRadius: 10 }}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Take First Snapshot
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12.5 }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-dim)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: "rgba(255, 255, 255, 0.02)",
                  }}
                >
                  <th style={{ padding: "12px 18px" }}>Snapshot Name</th>
                  <th style={{ padding: "12px 18px", width: 160 }}>Storage Target</th>
                  <th style={{ padding: "12px 18px", width: 120 }}>Size</th>
                  <th style={{ padding: "12px 18px", width: 160 }}>Created Date</th>
                  <th style={{ padding: "12px 18px", width: 110 }}>Status</th>
                  <th style={{ padding: "12px 18px", textAlign: "right", width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: i < backups.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      transition: "background-color 0.15s ease",
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: b.storageType === "GOOGLE_DRIVE" ? "rgba(56, 189, 248, 0.12)" : "rgba(192, 132, 252, 0.12)",
                            color: b.storageType === "GOOGLE_DRIVE" ? "#38bdf8" : "#c084fc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {b.storageType === "GOOGLE_DRIVE" ? <Cloud size={16} /> : <HardDrive size={16} />}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: "var(--text-pure)", fontFamily: "monospace", fontSize: 13, display: "block" }}>
                            {b.name}
                          </span>
                          <span style={{ fontSize: 10.5, color: "var(--text-dim)", fontFamily: "monospace" }}>
                            ID: {b.id.slice(0, 8)}…
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      {b.storageType === "GOOGLE_DRIVE" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#38bdf8",
                            background: "rgba(56, 189, 248, 0.12)",
                            padding: "4px 9px",
                            borderRadius: 9999,
                            border: "1px solid rgba(56, 189, 248, 0.25)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Cloud size={12} /> Google Drive
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#c084fc",
                            background: "rgba(192, 132, 252, 0.12)",
                            padding: "4px 9px",
                            borderRadius: 9999,
                            border: "1px solid rgba(192, 132, 252, 0.25)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <HardDrive size={12} /> Local Node
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 18px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12.5 }}>
                      {formatBytes(b.size || 0)}
                    </td>

                    <td style={{ padding: "14px 18px", color: "var(--text-muted)", fontSize: 12 }}>
                      {new Date(b.createdAt).toLocaleString()}
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: b.status === "COMPLETED" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                          color: b.status === "COMPLETED" ? "#34d399" : "#f87171",
                          border: b.status === "COMPLETED" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
                        }}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        {b.gdriveWebUrl && (
                          <a
                            href={b.gdriveWebUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open file in Google Drive"
                            className="btn-secondary-dark"
                            style={{ padding: "5px 9px", height: 28, fontSize: 11, borderRadius: 8, color: "#38bdf8" }}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          onClick={() => {
                            setRestoreBackup(b);
                            setWipeBeforeRestore(false);
                          }}
                          title="Restore snapshot"
                          className="btn-secondary-dark"
                          style={{
                            padding: "5px 12px",
                            height: 28,
                            fontSize: 11.5,
                            fontWeight: 700,
                            borderRadius: 8,
                            color: "#34d399",
                            borderColor: "rgba(16, 185, 129, 0.3)",
                            background: "rgba(16, 185, 129, 0.05)",
                          }}
                        >
                          <RotateCcw size={12} style={{ marginRight: 4 }} /> Restore
                        </button>

                        <button
                          onClick={() => handleDeleteBackup(b)}
                          disabled={deletingId === b.id}
                          title="Delete snapshot"
                          className="btn-danger-dark"
                          style={{ padding: "5px 9px", height: 28, borderRadius: 8 }}
                        >
                          {deletingId === b.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE BACKUP MODAL ── */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 0,
              overflow: "hidden",
              borderRadius: 20,
              border: "1px solid var(--border-medium)",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.8)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Archive size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>Create Server Snapshot</h3>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Archive files and compress game world state</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            {creating ? (
              <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(56, 189, 248, 0.2)", borderTopColor: "#38bdf8", animation: "spin 1s linear infinite" }} />
                  {createStorage === "GOOGLE_DRIVE" ? <Cloud size={26} style={{ color: "#38bdf8" }} /> : <HardDrive size={26} style={{ color: "#c084fc" }} />}
                </div>
                <div>
                  <h4 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    Packaging &amp; {createStorage === "GOOGLE_DRIVE" ? "Uploading to Google Drive..." : "Saving Snapshot..."}
                  </h4>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 5, maxWidth: 380, lineHeight: 1.5 }}>
                    Packaging server world files into a compressed ZIP archive and syncing directly to {createStorage === "GOOGLE_DRIVE" ? "Google Drive Cloud" : "local node disk"}. Please keep this page open.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-pure)", marginBottom: 6 }}>
                    Snapshot Archive Name
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    style={{
                      width: "100%",
                      height: 40,
                      padding: "0 12px",
                      background: "#0e0e11",
                      border: "1px solid #27272a",
                      borderRadius: 10,
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-pure)", marginBottom: 6 }}>
                    Storage Destination
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setCreateStorage("GOOGLE_DRIVE")}
                      disabled={!gdriveStatus.userLinked || !policies.allowGoogleDriveBackups}
                      style={{
                        height: 44,
                        borderRadius: 12,
                        fontSize: 12.5,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        cursor: gdriveStatus.userLinked ? "pointer" : "not-allowed",
                        transition: "all 0.15s ease",
                        border: createStorage === "GOOGLE_DRIVE" ? "1px solid #38bdf8" : "1px solid #27272a",
                        background: createStorage === "GOOGLE_DRIVE" ? "rgba(56, 189, 248, 0.15)" : "#121215",
                        color: createStorage === "GOOGLE_DRIVE" ? "#38bdf8" : "var(--text-muted)",
                        opacity: !gdriveStatus.userLinked ? 0.4 : 1,
                      }}
                    >
                      <Cloud size={16} />
                      <span>Google Drive</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateStorage("LOCAL")}
                      style={{
                        height: 44,
                        borderRadius: 12,
                        fontSize: 12.5,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        border: createStorage === "LOCAL" ? "1px solid #c084fc" : "1px solid #27272a",
                        background: createStorage === "LOCAL" ? "rgba(192, 132, 252, 0.15)" : "#121215",
                        color: createStorage === "LOCAL" ? "#c084fc" : "var(--text-muted)",
                      }}
                    >
                      <HardDrive size={16} />
                      <span>Node Storage</span>
                    </button>
                  </div>
                  {createStorage === "GOOGLE_DRIVE" && (
                    <p style={{ fontSize: 11.5, color: "#38bdf8", marginTop: 8 }}>
                      Google Drive retention active (max {policies.gdriveRetentionCount} backups; oldest deleted automatically).
                    </p>
                  )}
                </div>

                {/* Exclusion Checklist */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-pure)", marginBottom: 8 }}>
                    Excluded Paths (Saves Disk Space &amp; Time)
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { path: ".cache", label: "Exclude .cache/ (Build caches)" },
                      { path: "logs", label: "Exclude logs/ (Old console history)" },
                      { path: "crash-reports", label: "Exclude crash-reports/" },
                    ].map(({ path, label }) => (
                      <label
                        key={path}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "#121215",
                          border: "1px solid #27272a",
                          fontSize: 12,
                          color: "var(--text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={createExcludes.includes(path)}
                          onChange={() => toggleExclude(path, createExcludes, setCreateExcludes)}
                          className="rounded accent-sky-500"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary-dark"
                style={{ fontSize: 12.5, height: 38, borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creating}
                className="btn-solid-white"
                style={{
                  fontSize: 12.5,
                  height: 38,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontWeight: 700,
                }}
              >
                {creating ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                <span>{creating ? "Creating Archive..." : "Start Backup"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE / RE-ROLL MODAL ── */}
      {restoreBackup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 500,
              padding: 0,
              overflow: "hidden",
              borderRadius: 20,
              border: "1px solid rgba(234, 179, 8, 0.3)",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.85)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                background: "rgba(234, 179, 8, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(234, 179, 8, 0.15)",
                    color: "#facc15",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <RotateCcw size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
                    Restore / Re-roll Server State
                  </h3>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Rollback files from snapshot archive</p>
                </div>
              </div>
              <button
                onClick={() => setRestoreBackup(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
                You are restoring snapshot <strong style={{ color: "#38bdf8", fontFamily: "monospace" }}>{restoreBackup.name}</strong> onto <strong>{server.name}</strong>.
              </p>

              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(234, 179, 8, 0.06)",
                  border: "1px solid rgba(234, 179, 8, 0.25)",
                  fontSize: 12,
                  color: "#facc15",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 3 }}>
                  <AlertTriangle size={14} /> Attention
                </div>
                <span>Extracting will overwrite conflicting server files. Make sure the instance is stopped before restoring.</span>
              </div>

              {/* Wipe Clean Option */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid var(--border-medium)",
                  background: "#121215",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={wipeBeforeRestore}
                  onChange={(e) => setWipeBeforeRestore(e.target.checked)}
                  style={{ marginTop: 3 }}
                  className="accent-yellow-500"
                />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-pure)", display: "block" }}>
                    Wipe entire server directory before restore (Clean State)
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, display: "block" }}>
                    Removes all existing files first, ensuring no leftover corrupt chunks or rogue plugin configs remain.
                  </span>
                </div>
              </label>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setRestoreBackup(null)}
                className="btn-secondary-dark"
                style={{ fontSize: 12.5, height: 38, borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring}
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 10,
                  background: "#10b981",
                  color: "#000000",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 0 16px rgba(16, 185, 129, 0.3)",
                }}
              >
                {restoring ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                <span>{restoring ? "Restoring..." : "Confirm & Restore Snapshot"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AUTOMATION & RETENTION SETTINGS MODAL ── */}
      {showSettingsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 540,
              padding: 0,
              overflow: "hidden",
              borderRadius: 20,
              border: "1px solid var(--border-medium)",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.85)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Settings2 size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
                    Retention Policy &amp; Automated Schedules
                  </h3>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Configure cloud snapshot retention rules</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Retention Count */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-pure)", marginBottom: 4 }}>
                  Maximum Google Drive Backups to Retain (Rotation Limit)
                </label>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>
                  When limit is reached (e.g. {editRetention}), the oldest backup in Google Drive is automatically purged before uploading the new one.
                </p>
                <select
                  value={editRetention}
                  onChange={(e) => setEditRetention(parseInt(e.target.value))}
                  style={{
                    width: "100%",
                    height: 40,
                    padding: "0 12px",
                    background: "#0e0e11",
                    border: "1px solid #27272a",
                    borderRadius: 10,
                    color: "#ffffff",
                    fontSize: 12.5,
                    outline: "none",
                  }}
                >
                  <option value={1}>1 Snapshot (Most recent state only)</option>
                  <option value={2}>2 Snapshots</option>
                  <option value={3}>3 Snapshots (Recommended)</option>
                  <option value={5}>5 Snapshots</option>
                  <option value={10}>10 Snapshots</option>
                </select>
              </div>

              {/* Automatic Schedule */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-pure)", marginBottom: 4 }}>
                  Automated Recurring Schedule
                </label>
                <select
                  value={editSchedule}
                  onChange={(e) => setEditSchedule(e.target.value)}
                  style={{
                    width: "100%",
                    height: 40,
                    padding: "0 12px",
                    background: "#0e0e11",
                    border: "1px solid #27272a",
                    borderRadius: 10,
                    color: "#ffffff",
                    fontSize: 12.5,
                    outline: "none",
                  }}
                >
                  <option value="DISABLED">Disabled (Manual on-demand backups only)</option>
                  <option value="EVERY_6H">Every 6 Hours (Continuous backup)</option>
                  <option value="EVERY_12H">Every 12 Hours (Twice daily)</option>
                  <option value="DAILY">Daily at 03:00 AM UTC</option>
                  <option value="WEEKLY">Weekly (Every Sunday)</option>
                </select>
              </div>

              {/* Exclusions */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-pure)", marginBottom: 4 }}>
                  Default Excluded Paths
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {[
                    { path: ".cache", label: "Exclude .cache/" },
                    { path: "logs", label: "Exclude logs/" },
                    { path: "crash-reports", label: "Exclude crash-reports/" },
                  ].map(({ path, label }) => (
                    <label
                      key={path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#121215",
                        border: "1px solid #27272a",
                        fontSize: 12,
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editExcludes.includes(path)}
                        onChange={() => toggleExclude(path, editExcludes, setEditExcludes)}
                        className="rounded accent-sky-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                {/* Custom exclude input */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Add custom folder e.g. dynmap/web"
                    value={customSettingExclude}
                    onChange={(e) => setCustomSettingExclude(e.target.value)}
                    style={{
                      flex: 1,
                      height: 38,
                      padding: "0 12px",
                      background: "#0e0e11",
                      border: "1px solid #27272a",
                      borderRadius: 10,
                      color: "#ffffff",
                      fontSize: 12,
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addCustomExclude(editExcludes, setEditExcludes, customSettingExclude, setCustomSettingExclude)}
                    className="btn-secondary-dark"
                    style={{ fontSize: 12, borderRadius: 10, padding: "0 14px" }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowSettingsModal(false)}
                className="btn-secondary-dark"
                style={{ fontSize: 12.5, height: 38, borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-solid-white"
                style={{
                  fontSize: 12.5,
                  height: 38,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                }}
              >
                {savingSettings ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                <span>Save Policy Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
