"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Database, Plus, Trash2, Edit3, Server, Check, X, AlertCircle,
  Loader2, RefreshCw, Terminal, Copy, Eye, EyeOff, Activity, ShieldAlert,
  ServerCrash, HardDrive, CheckCircle2, ChevronRight, ExternalLink,
  Table, Layers, Play, Clock, ChevronLeft, Search
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
}

interface DatabaseHostItem {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  nodeId: string | null;
  node?: NodeItem | null;
  createdAt: string;
}

interface ServerDatabaseItem {
  id: string;
  serverId: string;
  name: string;
  databaseUser: string;
  host: string;
  port: number;
  connectionsFrom: string;
  createdAt: string;
  server: {
    id: string;
    name: string;
    node?: { name: string } | null;
  };
}

export default function AdminDatabasesPage() {
  const [hosts, setHosts] = useState<DatabaseHostItem[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [databases, setDatabases] = useState<ServerDatabaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Testing connection states
  const [testingHostId, setTestingHostId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; version?: string; message?: string }>>({});

  // Host Create / Edit Modal
  const [showHostModal, setShowHostModal] = useState(false);
  const [editingHost, setEditingHost] = useState<DatabaseHostItem | null>(null);
  const [hostForm, setHostForm] = useState({
    name: "",
    host: "127.0.0.1",
    port: 3306,
    username: "rubber",
    password: "",
    nodeId: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingHost, setSavingHost] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<{ success: boolean; version?: string; message?: string } | null>(null);
  const [testingModal, setTestingModal] = useState(false);

  // Setup Script Modal
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Delete confirmations
  const [deleteHostTarget, setDeleteHostTarget] = useState<DatabaseHostItem | null>(null);
  const [deleteDbTarget, setDeleteDbTarget] = useState<ServerDatabaseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Admin Explorer Modal State
  const [explorerDbName, setExplorerDbName] = useState<string | null>(null);
  const [explorerEndpoint, setExplorerEndpoint] = useState<string>("");
  const [explorerHostId, setExplorerHostId] = useState<string | undefined>(undefined);
  const [explorerTab, setExplorerTab] = useState<"data" | "schema" | "sql">("data");
  const [explorerTables, setExplorerTables] = useState<any[]>([]);
  const [explorerSelectedTable, setExplorerSelectedTable] = useState("");
  const [explorerTableSearch, setExplorerTableSearch] = useState("");
  const [loadingExplorerTables, setLoadingExplorerTables] = useState(false);

  const [explorerColumns, setExplorerColumns] = useState<any[]>([]);
  const [explorerRows, setExplorerRows] = useState<any[]>([]);
  const [explorerTotalRows, setExplorerTotalRows] = useState(0);
  const [explorerPage, setExplorerPage] = useState(1);
  const [loadingExplorerData, setLoadingExplorerData] = useState(false);
  const [explorerDataError, setExplorerDataError] = useState("");

  const [adminSqlQuery, setAdminSqlQuery] = useState("SELECT * FROM `` LIMIT 20;");
  const [runningAdminSql, setRunningAdminSql] = useState(false);
  const [adminSqlResult, setAdminSqlResult] = useState<any>(null);
  const [adminSqlError, setAdminSqlError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/databases");
      if (res.ok) {
        const data = await res.json();
        setHosts(data.hosts || []);
        setNodes(data.nodes || []);
        setDatabases(data.databases || []);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to load database hosts.");
      }
    } catch {
      setError("Network error fetching database management data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Test a specific host's live connection
  async function testHost(hostId: string) {
    setTestingHostId(hostId);
    try {
      const res = await fetch(`/api/admin/databases/${hostId}`, {
        method: "PUT",
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [hostId]: data }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [hostId]: { success: false, message: "Network error during ping." },
      }));
    } finally {
      setTestingHostId(null);
    }
  }

  // Test inside the modal
  async function testModalHost() {
    setTestingModal(true);
    setModalTestResult(null);
    try {
      const res = await fetch("/api/admin/database-hosts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hostForm),
      });
      const data = await res.json();
      setModalTestResult(data);
    } catch {
      setModalTestResult({ success: false, message: "Connection ping failed." });
    } finally {
      setTestingModal(false);
    }
  }

  function openCreateHost() {
    setEditingHost(null);
    setHostForm({
      name: "Primary Database Host",
      host: "127.0.0.1",
      port: 3306,
      username: "rubber",
      password: "",
      nodeId: "",
    });
    setModalTestResult(null);
    setShowHostModal(true);
  }

  function openEditHost(host: DatabaseHostItem) {
    setEditingHost(host);
    setHostForm({
      name: host.name,
      host: host.host,
      port: host.port,
      username: host.username,
      password: host.password || "",
      nodeId: host.nodeId || "",
    });
    setModalTestResult(null);
    setShowHostModal(true);
  }

  async function handleSaveHost(e: React.FormEvent) {
    e.preventDefault();
    setSavingHost(true);
    setError("");

    try {
      const url = editingHost
        ? `/api/admin/databases/${editingHost.id}`
        : "/api/admin/databases";
      const method = editingHost ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hostForm),
      });

      const data = await res.json();
      if (res.ok) {
        setShowHostModal(false);
        setSuccess(`Database host "${hostForm.name}" saved successfully!`);
        setTimeout(() => setSuccess(""), 4000);
        await loadData();
      } else {
        setModalTestResult({ success: false, message: data.error || "Failed to save host" });
      }
    } catch (err: any) {
      setModalTestResult({ success: false, message: err?.message || "Error saving database host" });
    } finally {
      setSavingHost(false);
    }
  }

  async function handleDeleteHost() {
    if (!deleteHostTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/databases/${deleteHostTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteHostTarget(null);
        setSuccess("Database host deleted.");
        setTimeout(() => setSuccess(""), 3000);
        await loadData();
      }
    } catch {}
    setDeleting(false);
  }

  async function handleDeleteServerDb() {
    if (!deleteDbTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/databases/server-db/${deleteDbTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteDbTarget(null);
        setSuccess(`Database "${deleteDbTarget.name}" dropped successfully.`);
        setTimeout(() => setSuccess(""), 3000);
        await loadData();
      }
    } catch {}
    setDeleting(false);
  }

  // Open Explorer
  async function openExplorer(dbName: string, endpoint: string, hostId?: string) {
    setExplorerDbName(dbName);
    setExplorerEndpoint(endpoint);
    setExplorerHostId(hostId);
    setExplorerTab("data");
    setExplorerTables([]);
    setExplorerSelectedTable("");
    setExplorerColumns([]);
    setExplorerRows([]);
    setAdminSqlResult(null);
    setAdminSqlError("");
    setLoadingExplorerTables(true);

    try {
      const url = `/api/admin/databases/explorer?action=tables&databaseName=${encodeURIComponent(dbName)}${hostId ? `&hostId=${hostId}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const tList = data.tables || [];
        setExplorerTables(tList);
        if (tList.length > 0) {
          const first = tList[0].name;
          setExplorerSelectedTable(first);
          setAdminSqlQuery(`SELECT * FROM \`${first}\` LIMIT 20;`);
          loadExplorerTableData(dbName, first, 1, hostId);
        } else {
          setAdminSqlQuery(`SHOW TABLES;`);
        }
      }
    } catch {}
    setLoadingExplorerTables(false);
  }

  async function loadExplorerTableData(dbName: string, tableName: string, page = 1, hostId?: string) {
    if (!tableName) return;
    setLoadingExplorerData(true);
    setExplorerDataError("");
    try {
      const url = `/api/admin/databases/explorer?action=data&databaseName=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tableName)}&page=${page}&limit=50${hostId ? `&hostId=${hostId}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setExplorerColumns(data.columns || []);
        setExplorerRows(data.rows || []);
        setExplorerTotalRows(data.total || 0);
        setExplorerPage(page);
      } else {
        const err = await res.json().catch(() => ({}));
        setExplorerDataError(err.error || "Failed to load table data");
      }
    } catch {
      setExplorerDataError("Network error loading table data");
    } finally {
      setLoadingExplorerData(false);
    }
  }

  async function runAdminQuery() {
    if (!adminSqlQuery.trim() || !explorerDbName) return;
    setRunningAdminSql(true);
    setAdminSqlError("");
    setAdminSqlResult(null);

    try {
      const res = await fetch("/api/admin/databases/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseName: explorerDbName,
          query: adminSqlQuery.trim(),
          hostId: explorerHostId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdminSqlResult(data);
        if (adminSqlQuery.toUpperCase().includes("CREATE") || adminSqlQuery.toUpperCase().includes("DROP") || adminSqlQuery.toUpperCase().includes("ALTER")) {
          // Refresh tables
          const tRes = await fetch(`/api/admin/databases/explorer?action=tables&databaseName=${encodeURIComponent(explorerDbName)}${explorerHostId ? `&hostId=${explorerHostId}` : ""}`);
          if (tRes.ok) {
            const td = await tRes.json();
            setExplorerTables(td.tables || []);
          }
        }
      } else {
        setAdminSqlError(data.error || "SQL execution failed");
      }
    } catch (err: any) {
      setAdminSqlError(err?.message || "Error running SQL command");
    } finally {
      setRunningAdminSql(false);
    }
  }

  const scriptCommand = `curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/setup-mysql.sh | sudo bash`;

  function copyScript() {
    copyToClipboard(scriptCommand);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* Top Banner & Stats */}
      <div
        className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              MySQL Database Fleet Management
            </h1>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              Pterodactyl Architecture
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
            Manage MySQL/MariaDB daemon hosts for each node, install engines with 1-click, and audit all server databases.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowScriptModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5 active:scale-95"
            style={{
              borderColor: "rgba(163, 230, 53, 0.3)",
              backgroundColor: "rgba(163, 230, 53, 0.08)",
              color: "#a3e635",
            }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>1-Click Install Script</span>
          </button>

          <button
            onClick={openCreateHost}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-black transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-lime-500/20"
            style={{ backgroundColor: "var(--color-rp-accent)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Database Host</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border flex items-center gap-3 text-xs bg-red-500/10 border-red-500/30 text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl border flex items-center gap-3 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="p-5 rounded-2xl border flex items-center justify-between"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Database Hosts</span>
            <p className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>{hosts.length}</p>
            <span className="text-[11px] text-gray-500">Fleet endpoints active</span>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div
          className="p-5 rounded-2xl border flex items-center justify-between"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Databases</span>
            <p className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>{databases.length}</p>
            <span className="text-[11px] text-gray-500">Hosted across game instances</span>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div
          className="p-5 rounded-2xl border flex items-center justify-between"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compute Nodes</span>
            <p className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>{nodes.length}</p>
            <span className="text-[11px] text-gray-500">Available to bind hosts</span>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Server className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Section 1: Database Hosts ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
      >
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                Database Hosts ({hosts.length})
              </h2>
              <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                Nodes and MySQL daemon connection targets
              </p>
            </div>
          </div>
        </div>

        {hosts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>No Database Hosts Configured</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Add a MySQL/MariaDB database host to allow users to create isolated databases for LuckPerms, CoreProtect, and plugins.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowScriptModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-lime-500/30 bg-lime-500/10 text-lime-400 hover:bg-lime-500/20"
              >
                1-Click Node Setup Script
              </button>
              <button
                onClick={openCreateHost}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-lime-400 text-black hover:brightness-110"
              >
                Add Host Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
            {hosts.map((host) => {
              const test = testResults[host.id];
              const isTesting = testingHostId === host.id;

              return (
                <div
                  key={host.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                        {host.name}
                      </span>
                      {host.node ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25">
                          Node: {host.node.name}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          Global Default Host
                        </span>
                      )}

                      {/* Live Test Status Badge */}
                      {test && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            test.success
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {test.success ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          <span>{test.success ? (test.version || "Connected") : "Connection Failed"}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-gray-400 flex-wrap">
                      <span>Endpoint: <strong className="text-gray-200">{host.host}:{host.port}</strong></span>
                      <span>User: <strong className="text-gray-200">{host.username}</strong></span>
                      <span>Bound Databases: <strong className="text-lime-400">{databases.filter(d => d.host === host.host || (!host.nodeId && d.host === "127.0.0.1")).length}</strong></span>
                    </div>

                    {test && !test.success && (
                      <p className="text-[11px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20 mt-1">
                        {test.message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => testHost(host.id)}
                      disabled={isTesting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5"
                      style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                      title="Test live connection"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-lime-400" : ""}`} />
                      <span>{isTesting ? "Testing..." : "Test Connection"}</span>
                    </button>

                    <button
                      onClick={() => openEditHost(host)}
                      className="p-2 rounded-lg border transition-all hover:bg-white/5 text-gray-300"
                      style={{ borderColor: "var(--color-rp-border)" }}
                      title="Edit Host"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteHostTarget(host)}
                      className="p-2 rounded-lg border transition-all hover:bg-red-500/10 text-red-400 border-red-500/20"
                      title="Delete Host"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Active Server Databases ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
      >
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                Server Databases Fleet ({databases.length})
              </h2>
              <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                Active databases provisioned across user server instances
              </p>
            </div>
          </div>
        </div>

        {databases.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No server databases have been provisioned by users yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className="border-b uppercase font-semibold text-gray-400"
                style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
              >
                <tr>
                  <th className="px-6 py-3">Server</th>
                  <th className="px-6 py-3">Database Name</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Host Endpoint</th>
                  <th className="px-6 py-3">Remote Allowed</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {databases.map((db) => (
                  <tr key={db.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-gray-200">{db.server?.name || "Unknown"}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{db.serverId.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-lime-400 font-bold">
                      {db.name}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-gray-300">
                      {db.databaseUser}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-gray-400">
                      {db.host}:{db.port}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-gray-400">
                      {db.connectionsFrom}
                    </td>
                    <td className="px-6 py-3.5 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => openExplorer(db.name, `${db.host}:${db.port}`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-lime-500/30 bg-lime-500/10 text-lime-400 hover:bg-lime-500/20 font-semibold transition-all"
                        title="Open Web GUI Database Explorer & SQL Shell"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>Manage &amp; Shell</span>
                      </button>

                      <button
                        onClick={() => setDeleteDbTarget(db)}
                        className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                        title="Force drop database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: 1-Click MySQL Installation Script ── */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border overflow-hidden p-6 space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/25 flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                    1-Click MariaDB/MySQL Setup Script
                  </h3>
                  <p className="text-xs text-gray-400">Run this command on your VPS to set up MariaDB in 15 seconds</p>
                </div>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-gray-300">
              <p>
                This script automatically installs MariaDB server, fixes socket permissions, configures <code className="text-lime-400 font-mono">bind-address = 0.0.0.0</code>, generates a secure administrative password, creates the <code className="text-lime-400 font-mono">rubber</code> user, and prints the exact credentials for you to plug into Rubber Panel:
              </p>

              <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-lime-300 flex items-center justify-between gap-3">
                <span className="overflow-x-auto select-all">{scriptCommand}</span>
                <button
                  onClick={copyScript}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 shrink-0"
                  title="Copy command"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                <p className="font-bold">Already have MariaDB installed but seeing &quot;Access Denied&quot;?</p>
                <p className="text-gray-300">
                  Run this quick command to grant privileges to user <code className="text-lime-400">rubber</code> with a password:
                </p>
                <code className="block bg-black/40 p-2 rounded text-lime-400 select-all overflow-x-auto">
                  sudo mysql -e &quot;CREATE USER IF NOT EXISTS &apos;rubber&apos;@&apos;%&apos; IDENTIFIED BY &apos;RubberSecret123!&apos;; GRANT ALL PRIVILEGES ON *.* TO &apos;rubber&apos;@&apos;%&apos; WITH GRANT OPTION; FLUSH PRIVILEGES;&quot;
                </code>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create / Edit Database Host ── */}
      {showHostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border overflow-hidden p-6 space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                    {editingHost ? "Edit Database Host" : "Add Database Host"}
                  </h3>
                  <p className="text-xs text-gray-400">Configure connection settings for this MySQL daemon</p>
                </div>
              </div>
              <button
                onClick={() => setShowHostModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHost} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Host Name
                </label>
                <input
                  type="text"
                  required
                  value={hostForm.name}
                  onChange={(e) => setHostForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Node 1 MariaDB or Primary Cloud SQL"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-medium"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Associate with Node
                </label>
                <select
                  value={hostForm.nodeId}
                  onChange={(e) => setHostForm((f) => ({ ...f, nodeId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-medium"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
                >
                  <option value="">Global Default Host (All nodes without specific host)</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.fqdn})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Servers deployed on this node will automatically allocate databases on this host.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Host IP / FQDN
                  </label>
                  <input
                    type="text"
                    required
                    value={hostForm.host}
                    onChange={(e) => setHostForm((f) => ({ ...f, host: e.target.value }))}
                    placeholder="127.0.0.1 or 192.168.1.3"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Port
                  </label>
                  <input
                    type="number"
                    required
                    value={hostForm.port}
                    onChange={(e) => setHostForm((f) => ({ ...f, port: parseInt(e.target.value) || 3306 }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={hostForm.username}
                    onChange={(e) => setHostForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="rubber or root"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={hostForm.password}
                      onChange={(e) => setHostForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Password"
                      className="w-full pl-3.5 pr-9 py-2.5 rounded-xl text-xs border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Test Result */}
              {modalTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    modalTestResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  {modalTestResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{modalTestResult.success ? (modalTestResult.message || "Connection established successfully!") : modalTestResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <button
                  type="button"
                  onClick={testModalHost}
                  disabled={testingModal}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingModal ? "animate-spin text-lime-400" : ""}`} />
                  <span>{testingModal ? "Testing..." : "Test Connection"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHostModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingHost}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-black bg-lime-400 hover:brightness-110 shadow-lg shadow-lime-500/20"
                  >
                    {savingHost && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Host</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Delete Host ── */}
      {deleteHostTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>Delete Database Host</h3>
            </div>
            <p className="text-xs text-gray-400">
              Are you sure you want to remove <strong>{deleteHostTarget.name}</strong> ({deleteHostTarget.host}:{deleteHostTarget.port})? Servers using this host will no longer be able to manage their databases through this endpoint.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteHostTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHost}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Delete Server Database ── */}
      {deleteDbTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center gap-3 text-red-400">
              <ServerCrash className="w-6 h-6" />
              <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>Drop Database</h3>
            </div>
            <p className="text-xs text-gray-400">
              Are you sure you want to permanently DROP database <strong className="text-lime-400 font-mono">{deleteDbTarget.name}</strong> on server <strong>{deleteDbTarget.server?.name}</strong>?
              <br /><br />
              <span className="text-red-400 font-semibold">Warning:</span> All tables, rows, and data will be permanently destroyed.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteDbTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteServerDb}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white"
              >
                {deleting ? "Dropping..." : "Confirm Drop"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal: Admin Web GUI Database Explorer & SQL Command Shell ── */}
      {explorerDbName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-7xl h-[88vh] rounded-2xl border overflow-hidden flex flex-col shadow-2xl"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            {/* Header */}
            <div
              className="px-6 py-3.5 border-b flex items-center justify-between flex-wrap gap-3"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-mono" style={{ color: "var(--color-rp-text)" }}>
                      {explorerDbName}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                      {explorerEndpoint}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Administrator Database Explorer &amp; Interactive SQL Terminal
                  </p>
                </div>
              </div>

              {/* View Tabs */}
              <div className="flex items-center gap-4">
                <div className="flex p-1 rounded-xl border border-white/10 bg-black/30">
                  <button
                    onClick={() => setExplorerTab("data")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      explorerTab === "data" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Table Data</span>
                  </button>
                  <button
                    onClick={() => setExplorerTab("schema")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      explorerTab === "schema" ? "bg-white text-black" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Schema Structure</span>
                  </button>
                  <button
                    onClick={() => setExplorerTab("sql")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      explorerTab === "sql" ? "bg-lime-400 text-black font-bold" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>SQL Shell</span>
                  </button>
                </div>

                <button
                  onClick={() => setExplorerDbName(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Body */}
            <div className="flex flex-1 min-h-0">
              {/* Left Column: Tables List */}
              <div
                className="w-64 border-r flex flex-col bg-black/20"
                style={{ borderColor: "var(--color-rp-border)" }}
              >
                <div className="p-2.5 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Filter tables..."
                      value={explorerTableSearch}
                      onChange={(e) => setExplorerTableSearch(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs border outline-none font-medium"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {loadingExplorerTables ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-lime-400" />
                      <span>Reading schema...</span>
                    </div>
                  ) : explorerTables.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      0 tables found in database
                    </div>
                  ) : (
                    explorerTables
                      .filter((t) => t.name.toLowerCase().includes(explorerTableSearch.toLowerCase()))
                      .map((t) => {
                        const isSelected = explorerSelectedTable === t.name;
                        return (
                          <button
                            key={t.name}
                            onClick={() => {
                              setExplorerSelectedTable(t.name);
                              setAdminSqlQuery(`SELECT * FROM \`${t.name}\` LIMIT 20;`);
                              loadExplorerTableData(explorerDbName, t.name, 1, explorerHostId);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-mono transition-all text-left ${
                              isSelected
                                ? "bg-lime-400/15 text-lime-400 border border-lime-400/30 font-bold"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Table className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{t.name}</span>
                            </div>
                            <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-500 shrink-0">
                              {t.rows}
                            </span>
                          </button>
                        );
                      })
                  )}
                </div>

                <div
                  className="px-3 py-2 border-t text-[11px] text-gray-500 flex items-center justify-between"
                  style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
                >
                  <span>{explorerTables.length} total tables</span>
                  <button
                    onClick={() => openExplorer(explorerDbName, explorerEndpoint, explorerHostId)}
                    className="p-1 hover:text-white"
                    title="Reload schema"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Right Column: View Contents */}
              <div className="flex-1 flex flex-col min-w-0 bg-black/10">
                {/* ── View 1: Data Grid ── */}
                {explorerTab === "data" && (
                  <div className="flex flex-col h-full min-h-0">
                    {/* Toolbar */}
                    <div
                      className="px-4 py-2 border-b flex items-center justify-between"
                      style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-lime-400">
                          {explorerSelectedTable || "No Table Selected"}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          ({explorerTotalRows} total rows)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => loadExplorerTableData(explorerDbName, explorerSelectedTable, explorerPage, explorerHostId)}
                          disabled={loadingExplorerData || !explorerSelectedTable}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border hover:bg-white/5 transition-all text-gray-300"
                          style={{ borderColor: "var(--color-rp-border)" }}
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingExplorerData ? "animate-spin" : ""}`} />
                          <span>Refresh</span>
                        </button>

                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <button
                            onClick={() => loadExplorerTableData(explorerDbName, explorerSelectedTable, explorerPage - 1, explorerHostId)}
                            disabled={explorerPage <= 1 || loadingExplorerData}
                            className="p-1 rounded border hover:bg-white/5 disabled:opacity-30"
                            style={{ borderColor: "var(--color-rp-border)" }}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span>{explorerPage} / {Math.ceil(explorerTotalRows / 50) || 1}</span>
                          <button
                            onClick={() => loadExplorerTableData(explorerDbName, explorerSelectedTable, explorerPage + 1, explorerHostId)}
                            disabled={explorerPage >= Math.ceil(explorerTotalRows / 50) || loadingExplorerData}
                            className="p-1 rounded border hover:bg-white/5 disabled:opacity-30"
                            style={{ borderColor: "var(--color-rp-border)" }}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {explorerDataError && (
                      <div className="p-3 text-xs bg-red-500/10 border-b border-red-500/25 text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{explorerDataError}</span>
                      </div>
                    )}

                    {/* Table View */}
                    <div className="flex-1 overflow-auto">
                      {loadingExplorerData ? (
                        <div className="p-16 text-center text-xs text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-lime-400" />
                          <span>Loading data rows...</span>
                        </div>
                      ) : explorerRows.length === 0 ? (
                        <div className="p-16 text-center text-xs text-gray-500">
                          This table contains 0 rows.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs font-mono border-collapse">
                          <thead
                            className="sticky top-0 z-10 border-b"
                            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                          >
                            <tr>
                              <th className="px-3 py-2 text-gray-500 border-r w-10 text-center" style={{ borderColor: "var(--color-rp-border)" }}>#</th>
                              {explorerColumns.map((c) => (
                                <th
                                  key={c.field}
                                  className="px-3 py-2 text-gray-300 font-bold border-r whitespace-nowrap"
                                  style={{ borderColor: "var(--color-rp-border)" }}
                                >
                                  <span>{c.field}</span>
                                  <span className="ml-1 text-[10px] text-gray-500 font-normal">{c.type}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                            {explorerRows.map((r, i) => (
                              <tr key={i} className="hover:bg-white/[0.02]">
                                <td className="px-3 py-1.5 text-gray-500 border-r text-center text-[10.5px]" style={{ borderColor: "var(--color-rp-border)" }}>
                                  {(explorerPage - 1) * 50 + i + 1}
                                </td>
                                {explorerColumns.map((c) => (
                                  <td
                                    key={c.field}
                                    className="px-3 py-1.5 border-r truncate max-w-xs text-gray-200"
                                    style={{ borderColor: "var(--color-rp-border)" }}
                                    title={String(r[c.field])}
                                  >
                                    {r[c.field] === null ? <span className="text-gray-500 italic">NULL</span> : String(r[c.field])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* ── View 2: Schema Structure ── */}
                {explorerTab === "schema" && (
                  <div className="flex-1 overflow-auto p-6">
                    <div
                      className="rounded-xl border overflow-hidden"
                      style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                    >
                      <div
                        className="px-4 py-3 border-b flex items-center gap-2 font-bold text-xs"
                        style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}
                      >
                        <Layers className="w-3.5 h-3.5 text-lime-400" />
                        <span>{explorerSelectedTable} Columns &amp; Data Types</span>
                      </div>
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="border-b uppercase text-gray-500 text-[10px]" style={{ borderColor: "var(--color-rp-border)" }}>
                          <tr>
                            <th className="px-4 py-2.5">Field</th>
                            <th className="px-4 py-2.5">Type</th>
                            <th className="px-4 py-2.5">Null</th>
                            <th className="px-4 py-2.5">Key</th>
                            <th className="px-4 py-2.5">Default</th>
                            <th className="px-4 py-2.5">Extra</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                          {explorerColumns.map((col) => (
                            <tr key={col.field} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2 font-bold text-white">{col.field}</td>
                              <td className="px-4 py-2 text-sky-400">{col.type}</td>
                              <td className="px-4 py-2 text-gray-400">{col.null}</td>
                              <td className="px-4 py-2">
                                {col.key === "PRI" ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                                    PRIMARY
                                  </span>
                                ) : (
                                  col.key || "—"
                                )}
                              </td>
                              <td className="px-4 py-2 text-gray-500">{col.default ?? "NULL"}</td>
                              <td className="px-4 py-2 text-gray-500">{col.extra || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── View 3: Interactive SQL Terminal ── */}
                {explorerTab === "sql" && (
                  <div className="flex flex-col h-full min-h-0">
                    <div
                      className="p-4 border-b space-y-3"
                      style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                    >
                      {/* Snippets */}
                      <div className="flex items-center gap-2 overflow-x-auto text-[11px]">
                        <span className="text-gray-500 uppercase font-semibold">Snippets:</span>
                        <button
                          onClick={() => setAdminSqlQuery(explorerSelectedTable ? `SELECT * FROM \`${explorerSelectedTable}\` LIMIT 50;` : `SHOW TABLES;`)}
                          className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 font-mono text-gray-300"
                        >
                          SELECT *
                        </button>
                        <button
                          onClick={() => setAdminSqlQuery(explorerSelectedTable ? `SELECT COUNT(*) as total FROM \`${explorerSelectedTable}\`;` : `SHOW TABLES;`)}
                          className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 font-mono text-gray-300"
                        >
                          COUNT(*)
                        </button>
                        <button
                          onClick={() => setAdminSqlQuery(`SHOW TABLES;`)}
                          className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 font-mono text-gray-300"
                        >
                          SHOW TABLES
                        </button>
                        <button
                          onClick={() => setAdminSqlQuery(explorerSelectedTable ? `DESCRIBE \`${explorerSelectedTable}\`;` : `SHOW TABLES;`)}
                          className="px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 font-mono text-gray-300"
                        >
                          DESCRIBE
                        </button>
                      </div>

                      {/* SQL Code Input */}
                      <textarea
                        rows={4}
                        value={adminSqlQuery}
                        onChange={(e) => setAdminSqlQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            runAdminQuery();
                          }
                        }}
                        placeholder="Enter SQL command..."
                        className="w-full p-3 rounded-xl font-mono text-xs outline-none border resize-vertical leading-relaxed text-lime-400 bg-black/60"
                        style={{ borderColor: "var(--color-rp-border)" }}
                      />

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">
                          Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">Ctrl+Enter</kbd> to execute
                        </span>

                        <button
                          onClick={runAdminQuery}
                          disabled={runningAdminSql || !adminSqlQuery.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-lime-400 text-black hover:brightness-110 disabled:opacity-50"
                        >
                          {runningAdminSql ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-black" />}
                          <span>{runningAdminSql ? "Executing..." : "Execute Query"}</span>
                        </button>
                      </div>
                    </div>

                    {adminSqlError && (
                      <div className="p-3 text-xs bg-red-500/10 border-b border-red-500/25 text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{adminSqlError}</span>
                      </div>
                    )}

                    {/* Results Container */}
                    <div className="flex-1 overflow-auto">
                      {adminSqlResult ? (
                        <div className="flex flex-col h-full">
                          {/* Telemetry bar */}
                          <div
                            className="px-4 py-2 border-b flex items-center gap-4 text-xs font-mono"
                            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                          >
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Query Succeeded
                            </span>
                            <span className="text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {adminSqlResult.durationMs}ms
                            </span>
                            <span className="text-gray-400">
                              {adminSqlResult.isSelect ? `${adminSqlResult.rowCount} rows returned` : `${adminSqlResult.affectedRows} rows affected`}
                            </span>
                          </div>

                          {adminSqlResult.isSelect && adminSqlResult.rows ? (
                            <div className="flex-1 overflow-auto">
                              <table className="w-full text-left text-xs font-mono border-collapse">
                                <thead
                                  className="sticky top-0 z-10 border-b"
                                  style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                                >
                                  <tr>
                                    <th className="px-3 py-2 text-gray-500 border-r w-10 text-center" style={{ borderColor: "var(--color-rp-border)" }}>#</th>
                                    {adminSqlResult.columns?.map((col: string) => (
                                      <th key={col} className="px-3 py-2 text-gray-300 font-bold border-r whitespace-nowrap" style={{ borderColor: "var(--color-rp-border)" }}>
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                                  {adminSqlResult.rows.map((row: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-white/[0.02]">
                                      <td className="px-3 py-1.5 text-gray-500 border-r text-center text-[10.5px]" style={{ borderColor: "var(--color-rp-border)" }}>
                                        {idx + 1}
                                      </td>
                                      {adminSqlResult.columns?.map((col: string) => (
                                        <td
                                          key={col}
                                          className="px-3 py-1.5 border-r truncate max-w-xs text-gray-200"
                                          style={{ borderColor: "var(--color-rp-border)" }}
                                          title={String(row[col])}
                                        >
                                          {row[col] === null ? <span className="text-gray-500 italic">NULL</span> : String(row[col])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-6 text-xs text-gray-300">
                              <p>{adminSqlResult.message || `Query OK, ${adminSqlResult.affectedRows} row(s) affected.`}</p>
                              {adminSqlResult.insertId ? <p className="mt-1 font-mono text-lime-400">Last Insert ID: {adminSqlResult.insertId}</p> : null}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-16 text-center text-xs text-gray-500">
                          Enter SQL commands above and click &quot;Execute Query&quot; to see real-time output.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

