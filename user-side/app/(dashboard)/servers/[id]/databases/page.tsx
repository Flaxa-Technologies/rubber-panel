"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Database, Plus, Trash2, RotateCcw, Copy, Check, Eye, EyeOff,
  Server, Shield, AlertCircle, Loader2, Link2, Globe
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useServer } from "@/components/server/ServerContext";

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

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [dbNameSuffix, setDbNameSuffix] = useState("");
  const [connectionsFrom, setConnectionsFrom] = useState("%");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Action states
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
        const d = await res.json();
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Banner / Quota Header */}
      <div className="card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
            <Database size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 10 }}>
              MySQL Databases
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: isLimitReached ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)", color: isLimitReached ? "#ef4444" : "#10b981", border: `1px solid ${isLimitReached ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}` }}>
                {usedCount} / {databaseLimit} Used
              </span>
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Dedicated MySQL databases for Minecraft plugins (LuckPerms, CoreProtect) and applications
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          disabled={isLimitReached || isCreationDisabled}
          className="btn btn-primary"
          style={{
            opacity: (isLimitReached || isCreationDisabled) ? 0.5 : 1,
            cursor: (isLimitReached || isCreationDisabled) ? "not-allowed" : "pointer",
          }}
          title={isCreationDisabled ? "Database creation is disabled for this server" : isLimitReached ? "Database limit reached" : ""}
        >
          <Plus size={15} />
          <span>New Database</span>
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "rgba(239, 68, 68, 0.3)", backgroundColor: "rgba(239, 68, 68, 0.08)", padding: 14, color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {isCreationDisabled && (
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, backgroundColor: "rgba(255, 255, 255, 0.02)" }}>
          <AlertCircle size={18} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            Database provisioning is currently set to <strong>0 databases</strong> for this server. If you require MySQL databases for plugins, contact an administrator to increase your database limit.
          </div>
        </div>
      )}

      {/* Database Cards List */}
      {databases.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", marginBottom: 16 }}>
            <Database size={24} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>No Databases Created</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 420, lineHeight: 1.5 }}>
            You haven't provisioned any MySQL databases for this instance yet. Click <strong>New Database</strong> to generate a dedicated database and credentials.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
          {databases.map((dbItem) => {
            const isPwVisible = Boolean(visiblePasswords[dbItem.id]);
            const jdbcString = `jdbc:mysql://${dbItem.databaseUser}:${dbItem.password || "PASSWORD"}@${dbItem.host}:${dbItem.port}/${dbItem.name}`;

            return (
              <div key={dbItem.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                      <Database size={16} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", fontFamily: "monospace" }}>
                        {dbItem.name}
                      </h4>
                      <p style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        Connections: {dbItem.connectionsFrom}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => handleRotatePassword(dbItem.id)}
                      disabled={rotatingId === dbItem.id}
                      className="btn btn-ghost"
                      style={{ padding: "6px 8px" }}
                      title="Rotate Password"
                    >
                      <RotateCcw size={14} className={rotatingId === dbItem.id ? "animate-spin" : ""} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(dbItem.id)}
                      className="btn btn-ghost"
                      style={{ padding: "6px 8px", color: "#ef4444" }}
                      title="Delete Database"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Details Table */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, backgroundColor: "rgba(0, 0, 0, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  {/* Host Endpoint */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Endpoint</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{dbItem.host}:{dbItem.port}</span>
                      <button onClick={() => handleCopy(`${dbItem.host}:${dbItem.port}`, `host-${dbItem.id}`)} className="btn btn-ghost" style={{ padding: 2 }}>
                        {copiedKey === `host-${dbItem.id}` ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Username */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Username</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{dbItem.databaseUser}</span>
                      <button onClick={() => handleCopy(dbItem.databaseUser, `user-${dbItem.id}`)} className="btn btn-ghost" style={{ padding: 2 }}>
                        {copiedKey === `user-${dbItem.id}` ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Password</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                        {isPwVisible ? (dbItem.password || "••••••••") : "••••••••••••••••"}
                      </span>
                      <button onClick={() => togglePasswordVisibility(dbItem.id)} className="btn btn-ghost" style={{ padding: 2 }} title={isPwVisible ? "Hide" : "Show"}>
                        {isPwVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button onClick={() => handleCopy(dbItem.password || "", `pw-${dbItem.id}`)} className="btn btn-ghost" style={{ padding: 2 }} title="Copy Password">
                        {copiedKey === `pw-${dbItem.id}` ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* JDBC String */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
                    <span style={{ color: "var(--text-dim)" }}>JDBC String</span>
                    <button onClick={() => handleCopy(jdbcString, `jdbc-${dbItem.id}`)} className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      {copiedKey === `jdbc-${dbItem.id}` ? <Check size={11} style={{ color: "#10b981" }} /> : <Copy size={11} />}
                      <span>Copy Connection String</span>
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Inline */}
                {deleteConfirmId === dbItem.id && (
                  <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", padding: 10, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, color: "#f87171" }}>Are you sure? This cannot be undone.</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setDeleteConfirmId(null)} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }}>Cancel</button>
                      <button onClick={() => handleDelete(dbItem.id)} disabled={deletingId === dbItem.id} className="btn btn-primary" style={{ padding: "4px 8px", fontSize: 11, backgroundColor: "#ef4444", borderColor: "#ef4444" }}>
                        {deletingId === dbItem.id ? "Deleting..." : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Database Modal ── */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                <Database size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Create New Database</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Generate an isolated MySQL database and credentials</p>
              </div>
            </div>

            {createError && (
              <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 10, borderRadius: 8, color: "#ef4444", fontSize: 12, marginBottom: 14 }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Database Name
                </label>
                <div style={{ display: "flex", alignItems: "center", borderRadius: 8, border: "1px solid var(--border)", backgroundColor: "var(--surface)", overflow: "hidden" }}>
                  <span style={{ padding: "0 10px", fontSize: 12, color: "var(--text-dim)", backgroundColor: "rgba(255, 255, 255, 0.03)", borderRight: "1px solid var(--border)", fontFamily: "monospace", height: 38, display: "flex", alignItems: "center" }}>
                    s_{shortId}_
                  </span>
                  <input
                    type="text"
                    value={dbNameSuffix}
                    onChange={(e) => setDbNameSuffix(e.target.value)}
                    placeholder="luckperms"
                    required
                    maxLength={16}
                    style={{ flex: 1, height: 38, padding: "0 12px", background: "transparent", border: "none", color: "#ffffff", fontSize: 13, outline: "none", fontFamily: "monospace" }}
                  />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  Full name will be: <code>s_{shortId}_{dbNameSuffix || "name"}</code>
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Connections From
                </label>
                <input
                  type="text"
                  value={connectionsFrom}
                  onChange={(e) => setConnectionsFrom(e.target.value)}
                  placeholder="%"
                  className="input"
                  style={{ width: "100%", height: 38, fontSize: 13, fontFamily: "monospace" }}
                />
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  Use <code>%</code> to allow connections from any host/IP, or specify a specific IP address.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{creating ? "Creating..." : "Create Database"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
