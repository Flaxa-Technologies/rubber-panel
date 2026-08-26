"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  RefreshCw,
  Server,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cloud,
  Key,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  HelpCircle,
  Sparkles,
  Lock,
  EyeOff,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";

interface BackupItem {
  id: string;
  name: string;
  status: string;
  storageType: string;
  size: number | null;
  gdriveFileId?: string | null;
  gdriveWebUrl?: string | null;
  createdAt: string;
  server: {
    id: string;
    name: string;
    uuid: string;
    owner?: { id: string; username: string; email: string };
    node?: { id: string; name: string };
  } | null;
}

interface BackupStats {
  totalBackups: number;
  completedBackups: number;
  gdriveBackups: number;
  localBackups: number;
  totalSizeBytes: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [stats, setStats] = useState<BackupStats>({
    totalBackups: 0,
    completedBackups: 0,
    gdriveBackups: 0,
    localBackups: 0,
    totalSizeBytes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStorage, setFilterStorage] = useState("all");

  // Google OAuth Config State
  const [gdriveConfig, setGdriveConfig] = useState<{
    configured: boolean;
    clientId?: string;
    fullClientId?: string;
    clientSecretSet: boolean;
  }>({ configured: false, clientSecretSet: false });
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState("");
  const [configError, setConfigError] = useState("");
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const redirectUri = "http://localhost:3002/api/auth/gdrive/callback";

  async function loadBackups() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/backups?status=${filterStatus}&storageType=${filterStorage}`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        if (data.stats) setStats(data.stats);
      }
    } catch {}
    setLoading(false);
  }

  async function loadGdriveConfig() {
    try {
      const res = await fetch("/api/admin/backups/gdrive/config");
      if (res.ok) {
        const data = await res.json();
        setGdriveConfig(data);
        if (data.fullClientId) {
          setClientIdInput(data.fullClientId);
        }
      }
    } catch {}
  }

  useEffect(() => {
    loadBackups();
    loadGdriveConfig();
  }, [filterStatus, filterStorage]);

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!clientIdInput) {
      setConfigError("Google Client ID is required.");
      return;
    }
    if (!gdriveConfig.clientSecretSet && !clientSecretInput) {
      setConfigError("Google Client Secret is required for initial setup.");
      return;
    }

    setSavingConfig(true);
    setConfigError("");
    setConfigSuccess("");

    try {
      const res = await fetch("/api/admin/backups/gdrive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdInput,
          clientSecret: clientSecretInput || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfigSuccess("Google Drive OAuth credentials saved securely! Client Secret is encrypted in DB.");
        setClientSecretInput(""); // Clear plain secret immediately from state
        await loadGdriveConfig();
      } else {
        setConfigError(data.error || "Failed to save Google credentials.");
      }
    } catch {
      setConfigError("Network error while saving credentials.");
    }
    setSavingConfig(false);
  }

  async function copyRedirectUri() {
    await navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  }

  const fieldStyle = {
    backgroundColor: "var(--color-rp-surface)",
    borderColor: "var(--color-rp-border)",
    color: "var(--color-rp-text)",
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{ backgroundColor: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
                Backups &amp; Cloud Storage
              </h1>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                Manage automatic backups, server snapshots, and Google Drive cloud storage integrations.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadBackups(); loadGdriveConfig(); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-white/[0.04]"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Snapshots", value: stats.totalBackups, sub: "Across all nodes", color: "var(--color-rp-text)", icon: Archive },
          { label: "Google Drive Backups", value: stats.gdriveBackups, sub: "Cloud replicated", color: "#38bdf8", icon: Cloud },
          { label: "Completed", value: stats.completedBackups, sub: "Ready for restore", color: "var(--color-rp-green)", icon: CheckCircle2 },
          { label: "Storage Consumed", value: formatBytes(stats.totalSizeBytes), sub: "Compressed archives", color: "#a855f7", icon: HardDrive },
        ].map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border p-4 sm:p-5 flex flex-col justify-between"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>{label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold" style={{ color }}>{value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Google Cloud OAuth 2.0 Credentials Card */}
      <div className="rounded-2xl border overflow-hidden shadow-lg"
        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: gdriveConfig.configured ? "rgba(56,189,248,0.3)" : "var(--color-rp-border)" }}>
        <div className="p-5 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: gdriveConfig.configured ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)", color: gdriveConfig.configured ? "var(--color-rp-green)" : "var(--color-rp-yellow)" }}>
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base" style={{ color: "var(--color-rp-text)" }}>
                  Google Drive Cloud OAuth Integration
                </h3>
                {gdriveConfig.configured ? (
                  <Badge variant="success" size="sm">Configured &amp; Active</Badge>
                ) : (
                  <Badge variant="warning" size="sm">Setup Required</Badge>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>
                Enables server owners to connect their own Google Drive for automated world snapshots with retention rotation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border self-start sm:self-auto transition-colors"
            style={{ borderColor: "var(--color-rp-border)", color: "#38bdf8", backgroundColor: "rgba(56,189,248,0.05)" }}>
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showGuide ? "Hide Setup Guide" : "How to get Credentials?"}</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Step-by-Step Interactive Guide */}
        {showGuide && (
          <div className="p-5 sm:p-6 border-b space-y-4"
            style={{ backgroundColor: "rgba(56,189,248,0.03)", borderColor: "var(--color-rp-border)" }}>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>Step-by-Step Google Cloud Console Setup (3 Minutes)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border space-y-1.5"
                style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                <p className="font-bold" style={{ color: "var(--color-rp-text)" }}>1. Create Cloud Project</p>
                <p style={{ color: "var(--color-rp-text-dim)" }}>
                  Visit <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-0.5">console.cloud.google.com <ExternalLink className="w-2.5 h-2.5" /></a>, create a project named <strong>RubberPanel</strong>, and enable the <strong>Google Drive API</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border space-y-1.5"
                style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                <p className="font-bold" style={{ color: "var(--color-rp-text)" }}>2. Configure OAuth Consent</p>
                <p style={{ color: "var(--color-rp-text-dim)" }}>
                  Go to <strong>OAuth Consent Screen</strong> &rarr; User Type <strong>External</strong> &rarr; Add app name and support email &rarr; Add scope <code>.../auth/drive.file</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border space-y-1.5"
                style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                <p className="font-bold" style={{ color: "var(--color-rp-text)" }}>3. Create Credentials &amp; Copy</p>
                <p style={{ color: "var(--color-rp-text-dim)" }}>
                  Go to <strong>Credentials</strong> &rarr; <strong>Create Credentials</strong> &rarr; <strong>OAuth client ID (Web application)</strong> &rarr; Add the Authorized Redirect URI below.
                </p>
              </div>
            </div>

            {/* Copyable Redirect URI */}
            <div className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--color-rp-text-muted)" }}>
                  Authorized Redirect URI (Paste this into Google Cloud Console)
                </p>
                <p className="font-mono text-xs mt-0.5 font-bold text-cyan-400">{redirectUri}</p>
              </div>
              <button
                type="button"
                onClick={copyRedirectUri}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all self-start sm:self-auto"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                {copiedRedirect ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRedirect ? "Copied!" : "Copy URI"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSaveCredentials} className="p-5 sm:p-6 space-y-4">
          {configError && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "var(--color-rp-red)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{configError}</span>
            </div>
          )}

          {configSuccess && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2"
              style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "var(--color-rp-green)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{configSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--color-rp-text)" }}>
                Google OAuth Client ID
              </label>
              <input
                type="text"
                placeholder="e.g. 1234567890-abcdef.apps.googleusercontent.com"
                value={clientIdInput}
                onChange={e => setClientIdInput(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-xs font-mono outline-none"
                style={fieldStyle}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold" style={{ color: "var(--color-rp-text)" }}>
                  Google OAuth Client Secret
                </label>
                {gdriveConfig.clientSecretSet && (
                  <span className="text-[11px] font-semibold text-green-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Encrypted &amp; Stored in Database
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="password"
                  placeholder={gdriveConfig.clientSecretSet ? "•••••••••••••••••••• (Leave blank to keep current)" : "GOCSPX-..."}
                  value={clientSecretInput}
                  onChange={e => setClientSecretInput(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-xl border text-xs font-mono outline-none"
                  style={fieldStyle}
                />
                <div className="absolute right-3 top-2.5 text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                  <EyeOff className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Security Guarantee: Client secret is never exposed in browser APIs and can only be overwritten.</span>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow disabled:opacity-50"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
              {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              <span>{gdriveConfig.configured ? "Update / Overwrite Credentials" : "Save & Enable Google Drive"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Global Backups Inventory Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-rp-text)" }}>Global Backups Inventory</h2>
            <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
              Live record of all server snapshots across nodes and Google Drive accounts.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterStorage}
              onChange={e => setFilterStorage(e.target.value)}
              className="h-9 px-3 rounded-xl border text-xs outline-none"
              style={fieldStyle}>
              <option value="all">All Storage Types</option>
              <option value="GOOGLE_DRIVE">Google Drive Cloud</option>
              <option value="LOCAL">Local Node</option>
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded-xl border text-xs outline-none"
              style={fieldStyle}>
              <option value="all">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Backups Table */}
        <div className="rounded-2xl border overflow-hidden shadow"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2 text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Loading backup records...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-16 text-center">
              <Archive className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-rp-text-dim)" }} />
              <p className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>No backups found</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                {filterStatus !== "all" || filterStorage !== "all"
                  ? "Try changing your filter options."
                  : "Server owners can take backups on-demand or on automatic schedule from their panel."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider font-semibold"
                    style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                    <th className="px-4 py-3.5">Backup Name</th>
                    <th className="px-4 py-3.5">Server / Owner</th>
                    <th className="px-4 py-3.5">Storage Location</th>
                    <th className="px-4 py-3.5">Size</th>
                    <th className="px-4 py-3.5">Created At</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium" style={{ borderColor: "var(--color-rp-border)" }}>
                  {backups.map((b) => (
                    <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                            style={{ backgroundColor: b.storageType === "GOOGLE_DRIVE" ? "rgba(56,189,248,0.12)" : "rgba(168,85,247,0.12)", color: b.storageType === "GOOGLE_DRIVE" ? "#38bdf8" : "#c084fc" }}>
                            {b.storageType === "GOOGLE_DRIVE" ? <Cloud className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-mono font-bold" style={{ color: "var(--color-rp-text)" }}>{b.name}</span>
                            <span className="block text-[10px] font-mono" style={{ color: "var(--color-rp-text-dim)" }}>ID: {b.id.slice(0, 8)}…</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-bold block" style={{ color: "var(--color-rp-text)" }}>{b.server?.name || "Unknown Server"}</span>
                        <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                          {b.server?.owner?.username || "—"} ({b.server?.node?.name || "Node"})
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {b.storageType === "GOOGLE_DRIVE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
                            <Cloud className="w-3 h-3" /> Google Drive
                          </span>
                        ) : b.storageType === "BOTH" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "var(--color-rp-green)" }}>
                            Cloud &amp; Local
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: "rgba(168,85,247,0.12)", color: "#c084fc" }}>
                            <HardDrive className="w-3 h-3" /> Local Node
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                        {formatBytes(b.size || 0)}
                      </td>

                      <td className="px-4 py-3.5 text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                        {new Date(b.createdAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5">
                        {b.status === "COMPLETED" ? (
                          <Badge variant="success" size="sm">Completed</Badge>
                        ) : b.status === "FAILED" ? (
                          <Badge variant="danger" size="sm">Failed</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">{b.status}</Badge>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {b.gdriveWebUrl ? (
                          <a
                            href={b.gdriveWebUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-cyan-500/10"
                            style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.25)" }}>
                            <span>View in Drive</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>Local Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
