"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Database, Plus, Trash2, RotateCcw, Copy, Check, Eye, EyeOff,
  Server, AlertCircle, Loader2, Globe, X, CheckCircle2, Terminal
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useServer } from "@/components/server/ServerContext";
import DatabaseExplorerModal from "@/components/database/DatabaseExplorerModal";

interface ServerDatabaseItem {
  id: string;
  name: string;
  databaseUser: string;
  password?: string;
  host: string;
  port: number;
  connectionsFrom: string;
  createdAt: string;
}

export default function ServerDatabasesPage() {
  const { id } = useParams<{ id: string }>();
  const { server } = useServer();

  const [databases, setDatabases] = useState<ServerDatabaseItem[]>([]);
  const [databaseLimit, setDatabaseLimit] = useState<number>(0);
  const [usedCount, setUsedCount] = useState<number>(0);
  const [nodeHost, setNodeHost] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [dbNameSuffix, setDbNameSuffix] = useState("");
  const [connectionsFrom, setConnectionsFrom] = useState("%");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Action states
  const [activeExplorerDb, setActiveExplorerDb] = useState<ServerDatabaseItem | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadDatabases = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/servers/${id}/databases`);
      if (res.ok) {
        const data = await res.json();
        setDatabases(data.databases || []);
        setDatabaseLimit(data.databaseLimit ?? 0);
        setUsedCount(data.usedCount ?? (data.databases || []).length);
        setNodeHost(data.nodeHost || "");
        setError("");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to load databases");
      }
    } catch {
      setError("Network error loading databases");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  function handleCopy(text: string, key: string) {
    copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function togglePasswordVisibility(dbId: string) {
    setVisiblePasswords((prev) => ({ ...prev, [dbId]: !prev[dbId] }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch(`/api/user/servers/${id}/databases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dbNameSuffix,
          connectionsFrom: connectionsFrom || "%",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCreate(false);
        setDbNameSuffix("");
        setConnectionsFrom("%");
        setSuccess(`Database ${data.database?.name || ""} provisioned successfully!`);
        setTimeout(() => setSuccess(""), 4000);
        await loadDatabases();
      } else {
        setCreateError(data.error || "Failed to create database");
      }
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create database");
    } finally {
      setCreating(false);
    }
  }

  async function handleRotatePassword(dbId: string) {
    setRotatingId(dbId);
    try {
      const res = await fetch(`/api/user/servers/${id}/databases/${dbId}`, {
        method: "PATCH",
      });
      if (res.ok) {
        setSuccess("Database password rotated successfully!");
        setTimeout(() => setSuccess(""), 4000);
        await loadDatabases();
      }
    } catch {}
    setRotatingId(null);
  }

  async function handleDelete(dbId: string) {
    setDeletingId(dbId);
    try {
      const res = await fetch(`/api/user/servers/${id}/databases/${dbId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        setSuccess("Database dropped successfully.");
        setTimeout(() => setSuccess(""), 4000);
        await loadDatabases();
      }
    } catch {}
    setDeletingId(null);
  }

  const shortId = (server?.uuid || server?.id || id).replace(/-/g, "").slice(0, 8);
  const isLimitReached = databaseLimit > 0 && usedCount >= databaseLimit;
  const isCreationDisabled = databaseLimit <= 0;

  if (loading) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-dim)" }}>
        <Loader2 className="animate-spin" size={24} style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 13 }}>Loading database endpoints...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Header Card */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              MySQL Databases
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 9999,
                background: isLimitReached ? "rgba(239, 68, 68, 0.15)" : "var(--bg-surface-elevated)",
                color: isLimitReached ? "#f87171" : "var(--text-primary)",
                border: isLimitReached ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-medium)",
              }}
            >
              {usedCount} / {databaseLimit} Used
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Provision isolated MySQL databases, manage dedicated credentials, and configure remote connections.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError("");
            setShowCreate(true);
          }}
          disabled={isLimitReached || isCreationDisabled}
          className="btn-solid-white"
          style={{
            padding: "8px 16px",
            fontSize: 12.5,
            opacity: isLimitReached || isCreationDisabled ? 0.5 : 1,
            cursor: isLimitReached || isCreationDisabled ? "not-allowed" : "pointer",
          }}
        >
          <Plus size={14} />
          <span>New Database</span>
        </button>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: 12.5, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 600 }}>Database Service Notice</p>
            <p style={{ opacity: 0.9, marginTop: 2 }}>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-sm)", color: "#34d399", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* Database Limit 0 Notice */}
      {isCreationDisabled && (
        <div className="saas-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: 14, background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
          <AlertCircle size={20} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "#f59e0b" }}>
              Database Provisioning Not Configured
            </h4>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              The database quota for this instance is set to 0. An administrator can increase the MySQL Databases Limit from the Admin Panel.
            </p>
          </div>
        </div>
      )}

      {/* Database List */}
      {databases.length === 0 ? (
        <div className="saas-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--text-dim)" }}>
            <Database size={20} />
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>No databases created</h3>
          <p style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 360, margin: "6px auto 16px" }}>
            {isCreationDisabled
              ? "Databases are currently disabled for this instance."
              : "Click 'New Database' to spin up an isolated MySQL database and user credentials."}
          </p>
          {!isCreationDisabled && !isLimitReached && (
            <button
              onClick={() => {
                setCreateError("");
                setShowCreate(true);
              }}
              className="btn-solid-white"
              style={{ padding: "7px 14px", fontSize: 12.5 }}
            >
              <Plus size={13} />
              <span>Create Database</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {databases.map((dbItem) => {
            const isPasswordVisible = visiblePasswords[dbItem.id];
            const jdbcUrl = `jdbc:mysql://${dbItem.host}:${dbItem.port}/${dbItem.name}`;

            return (
              <div
                key={dbItem.id}
                className="saas-card"
                style={{ padding: "18px 20px" }}
              >
                {/* Header Row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                      <Database size={15} />
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "var(--text-pure)" }}>
                        {dbItem.name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
                        Created {new Date(dbItem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => setActiveExplorerDb(dbItem)}
                      className="btn-solid-white"
                      style={{ padding: "6px 12px", fontSize: 11.5, background: "#a3e635", color: "#000000", fontWeight: 700 }}
                      title="Open Web GUI Database Explorer & SQL Shell"
                    >
                      <Terminal size={12} />
                      <span>Manage &amp; SQL Shell</span>
                    </button>

                    <button
                      onClick={() => handleRotatePassword(dbItem.id)}
                      disabled={rotatingId === dbItem.id}
                      className="btn-secondary-dark"
                      style={{ padding: "6px 12px", fontSize: 11.5 }}
                      title="Generate a new secure password"
                    >
                      <RotateCcw size={12} className={rotatingId === dbItem.id ? "spin" : ""} />
                      <span>Rotate Password</span>
                    </button>

                    {deleteConfirmId === dbItem.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => handleDelete(dbItem.id)}
                          disabled={deletingId === dbItem.id}
                          className="btn-danger-dark"
                          style={{ padding: "6px 12px", fontSize: 11.5 }}
                        >
                          {deletingId === dbItem.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                          <span>Confirm Delete</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="btn-secondary-dark"
                          style={{ padding: "6px 10px", fontSize: 11.5 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(dbItem.id)}
                        className="btn-secondary-dark"
                        style={{ padding: "6px 10px", fontSize: 11.5, color: "#f87171" }}
                        title="Delete database"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Connection Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 14 }}>
                  {/* Host Endpoint */}
                  <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Endpoint</span>
                      <button
                        onClick={() => handleCopy(`${dbItem.host}:${dbItem.port}`, `endpoint-${dbItem.id}`)}
                        style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2 }}
                        title="Copy Endpoint"
                      >
                        {copiedKey === `endpoint-${dbItem.id}` ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
                      </button>
                    </div>
                    <span style={{ fontSize: 12.5, fontFamily: "monospace", color: "var(--text-primary)" }}>
                      {dbItem.host}:{dbItem.port}
                    </span>
                  </div>

                  {/* Username */}
                  <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Username</span>
                      <button
                        onClick={() => handleCopy(dbItem.databaseUser, `user-${dbItem.id}`)}
                        style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2 }}
                        title="Copy Username"
                      >
                        {copiedKey === `user-${dbItem.id}` ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
                      </button>
                    </div>
                    <span style={{ fontSize: 12.5, fontFamily: "monospace", color: "var(--text-primary)" }}>
                      {dbItem.databaseUser}
                    </span>
                  </div>

                  {/* Password */}
                  <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => togglePasswordVisibility(dbItem.id)}
                          style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2 }}
                          title={isPasswordVisible ? "Hide password" : "Show password"}
                        >
                          {isPasswordVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        {dbItem.password && (
                          <button
                            onClick={() => handleCopy(dbItem.password!, `pass-${dbItem.id}`)}
                            style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2 }}
                            title="Copy Password"
                          >
                            {copiedKey === `pass-${dbItem.id}` ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 12.5, fontFamily: "monospace", color: "var(--text-primary)" }}>
                      {isPasswordVisible ? (dbItem.password || "••••••••") : "••••••••••••••••"}
                    </span>
                  </div>

                  {/* Connections From */}
                  <div style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Allowed IPs</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontFamily: "monospace", color: "var(--text-primary)" }}>
                      {dbItem.connectionsFrom === "%" ? "Any (%)" : dbItem.connectionsFrom}
                    </span>
                  </div>
                </div>

                {/* JDBC Connection String */}
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>JDBC</span>
                    <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {jdbcUrl}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(jdbcUrl, `jdbc-${dbItem.id}`)}
                    className="btn-secondary-dark"
                    style={{ padding: "4px 8px", fontSize: 11, flexShrink: 0 }}
                  >
                    {copiedKey === `jdbc-${dbItem.id}` ? <Check size={11} style={{ color: "#34d399" }} /> : <Copy size={11} />}
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Database Modal ── */}
      {showCreate && (
        <div className="saas-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div
            className="saas-modal-box"
            style={{
              maxWidth: 480,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                  <Database size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    Create New Database
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Generate an isolated MySQL database and credentials
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {createError && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: 12 }}>
                  {createError}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Database Name
                </label>
                <div style={{ display: "flex", alignItems: "center", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-medium)", background: "var(--bg-surface-elevated)", overflow: "hidden" }}>
                  <span style={{ padding: "0 10px", fontSize: 12, color: "var(--text-dim)", background: "rgba(255, 255, 255, 0.03)", borderRight: "1px solid var(--border-medium)", fontFamily: "monospace", height: 38, display: "flex", alignItems: "center" }}>
                    s_{shortId}_
                  </span>
                  <input
                    type="text"
                    value={dbNameSuffix}
                    onChange={(e) => setDbNameSuffix(e.target.value)}
                    placeholder="luckperms"
                    required
                    maxLength={16}
                    style={{ flex: 1, height: 38, padding: "0 12px", background: "transparent", border: "none", color: "var(--text-pure)", fontSize: 13, outline: "none", fontFamily: "monospace" }}
                  />
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                  Full name: <code>s_{shortId}_{dbNameSuffix || "suffix"}</code>
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Connections Allowed From
                </label>
                <input
                  type="text"
                  value={connectionsFrom}
                  onChange={(e) => setConnectionsFrom(e.target.value)}
                  placeholder="%"
                  className="saas-input"
                  style={{ fontFamily: "monospace", fontSize: 12.5 }}
                />
                <span style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                  Use <code>%</code> for any remote host, or enter a specific IP (e.g. 192.168.1.3).
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary-dark"
                  style={{ padding: "7px 14px", fontSize: 12.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-solid-white"
                  style={{ padding: "7px 16px", fontSize: 12.5 }}
                >
                  {creating ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                  <span>{creating ? "Provisioning..." : "Create Database"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Web GUI Database Explorer & SQL Command Shell Modal ── */}
      {activeExplorerDb && (
        <DatabaseExplorerModal
          isOpen={Boolean(activeExplorerDb)}
          onClose={() => setActiveExplorerDb(null)}
          serverId={id}
          databaseId={activeExplorerDb.id}
          databaseName={activeExplorerDb.name}
          hostEndpoint={`${activeExplorerDb.host}:${activeExplorerDb.port}`}
        />
      )}
    </div>
  );
}
