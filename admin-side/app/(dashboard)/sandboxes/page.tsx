"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  Search, RefreshCw, Plus, X, Loader2, Play, Square,
  RotateCcw, Trash2, Pencil, HardDrive, Cpu, Network,
  ExternalLink, Terminal, Clock, Sparkles, Box, Code2,
  Calendar, Check, ShieldAlert, Laptop, Eye, EyeOff, Lock
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/Badge";

interface SandboxItem {
  id: string;
  name: string;
  uuid: string;
  status: string;
  suspended: boolean;
  ram: number;
  cpu: number;
  disk: number;
  createdAt: string;
  sandboxRuntime?: string | null;
  sandboxDailyHoursLimit?: number | null;
  sandboxUsedMinutesToday?: number;
  sandboxAutoShutdownMinutes?: number;
  sandboxPassword?: string | null;
  expiresAt?: string | null;
  gracePeriodDays?: number;
  autoSuspendOnExpiry?: boolean;
  autoDeleteOnGraceExpiry?: boolean;
  owner: { id: string; username: string; email: string } | null;
  node: { id: string; name: string; fqdn?: string; status: string } | null;
  allocations: { ip: string; port: number }[];
}

interface UserOption {
  id: string;
  username: string;
  email: string;
}

interface NodeOption {
  id: string;
  name: string;
  fqdn: string;
  status: string;
  maintenanceMode: boolean;
}

interface AllocationOption {
  id: string;
  ip: string;
  port: number;
  assigned: boolean;
}

const RUNTIMES = [
  { id: "fullstack", name: "Fullstack Universal", desc: "Node.js 20, Python 3, Git, Zsh & build tools", icon: Code2, image: "codercom/code-server:latest" },
  { id: "nodejs", name: "Node.js LTS Stack", desc: "Node.js 20/22, NPM, PNPM, Bun & TypeScript", icon: Laptop, image: "codercom/code-server:latest" },
  { id: "python", name: "Python 3.12 AI & Data", desc: "Python 3.12, Pip, VirtualEnv & Data tools", icon: Terminal, image: "codercom/code-server:latest" },
  { id: "rust", name: "Rust & Cargo Engine", desc: "Rust 1.78+, Cargo, Rust-Analyzer & GCC", icon: Sparkles, image: "codercom/code-server:latest" },
  { id: "golang", name: "Golang Cloud Backend", desc: "Go 1.22+, Gvm, Delve debugger & tools", icon: Box, image: "codercom/code-server:latest" },
  { id: "java", name: "Java 21 Spring & Gradle", desc: "OpenJDK 21, Gradle, Maven & Java LS", icon: HardDrive, image: "codercom/code-server:latest" },
  { id: "custom", name: "Custom Docker Image", desc: "Use your own custom code-server container image", icon: Box, image: "" },
];

function SandboxesContent() {
  const [sandboxes, setSandboxes] = useState<SandboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [nodeFilter, setNodeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0, uniqueUsers: 0 });

  // Creation Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Modal State
  const [editingSandbox, setEditingSandbox] = useState<SandboxItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Form state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [allocations, setAllocations] = useState<AllocationOption[]>([]);

  const [form, setForm] = useState({
    name: "",
    ownerId: "",
    nodeId: "",
    ram: "2048",
    cpu: "100",
    disk: "10240",
    swap: "0",
    allocationId: "",
    specificPorts: "",
    sandboxRuntime: "fullstack",
    customDockerImage: "",
    sandboxDailyHoursLimit: "0", // 0 = unlimited
    sandboxAutoShutdownMinutes: "30",
    sandboxPassword: "",
    expiresAt: "",
    gracePeriodDays: "3",
    autoSuspendOnExpiry: true,
    autoDeleteOnGraceExpiry: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SandboxItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (nodeFilter) params.set("nodeId", nodeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/sandboxes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSandboxes(data.sandboxes || []);
        setStats(data.stats || { total: 0, running: 0, stopped: 0, uniqueUsers: 0 });
      }
    } catch {}
    setLoading(false);
  }, [search, nodeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Load auxiliary data for modal
  useEffect(() => {
    async function loadAux() {
      const [uRes, nRes] = await Promise.all([
        fetch("/api/admin/users?limit=200").then(r => r.json()).catch(() => ({ users: [] })),
        fetch("/api/admin/nodes").then(r => r.json()).catch(() => ({ nodes: [] })),
      ]);
      setUsers(uRes.users || []);
      setNodes(nRes.nodes || []);
    }
    loadAux();
  }, []);

  // Fetch free allocations when node is selected
  useEffect(() => {
    if (!form.nodeId) {
      setAllocations([]);
      return;
    }
    fetch(`/api/admin/allocations?nodeId=${form.nodeId}&assigned=false`)
      .then(r => r.json())
      .then(d => setAllocations(d.allocations || []))
      .catch(() => setAllocations([]));
  }, [form.nodeId]);

  async function handleCreateSandbox() {
    setCreating(true);
    setCreateError("");

    const specificPortsList = form.specificPorts
      .split(",")
      .map(p => p.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n) && n > 0);

    try {
      const res = await fetch("/api/admin/sandboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ownerId: form.ownerId,
          nodeId: form.nodeId,
          ram: parseInt(form.ram),
          cpu: parseInt(form.cpu),
          disk: parseInt(form.disk),
          swap: parseInt(form.swap) || 0,
          allocationId: form.allocationId || undefined,
          specificPorts: specificPortsList,
          sandboxRuntime: form.sandboxRuntime,
          dockerImageOverride: form.sandboxRuntime === "custom" ? form.customDockerImage : undefined,
          sandboxDailyHoursLimit: parseInt(form.sandboxDailyHoursLimit) || 0,
          sandboxAutoShutdownMinutes: parseInt(form.sandboxAutoShutdownMinutes) || 0,
          sandboxPassword: form.sandboxPassword || undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          gracePeriodDays: parseInt(form.gracePeriodDays) || 3,
          autoSuspendOnExpiry: form.autoSuspendOnExpiry,
          autoDeleteOnGraceExpiry: form.autoDeleteOnGraceExpiry,
        }),
      });

      if (res.ok) {
        setShowCreate(false);
        setStep(1);
        setForm({
          name: "",
          ownerId: "",
          nodeId: "",
          ram: "2048",
          cpu: "100",
          disk: "10240",
          swap: "0",
          allocationId: "",
          specificPorts: "",
          sandboxRuntime: "fullstack",
          customDockerImage: "",
          sandboxDailyHoursLimit: "0",
          sandboxAutoShutdownMinutes: "30",
          sandboxPassword: "",
          expiresAt: "",
          gracePeriodDays: "3",
          autoSuspendOnExpiry: true,
          autoDeleteOnGraceExpiry: false,
        });
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.error || "Failed to create Code Sandbox.");
      }
    } catch {
      setCreateError("Connection failed to server API.");
    }
    setCreating(false);
  }

  async function handlePower(id: string, action: "start" | "stop" | "restart" | "kill") {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/servers/${id}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
    } catch {}
    setActionLoading(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/sandboxes/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        await load();
      }
    } catch {}
    setDeleting(false);
  }

  async function handleSaveEdit() {
    if (!editingSandbox) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/sandboxes/${editingSandbox.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingSandbox.name,
          ram: editingSandbox.ram,
          cpu: editingSandbox.cpu,
          disk: editingSandbox.disk,
          sandboxDailyHoursLimit: editingSandbox.sandboxDailyHoursLimit,
          sandboxAutoShutdownMinutes: editingSandbox.sandboxAutoShutdownMinutes,
          sandboxPassword: editingSandbox.sandboxPassword,
          suspended: editingSandbox.suspended,
        }),
      });
      if (res.ok) {
        setEditingSandbox(null);
        await load();
      }
    } catch {}
    setSavingEdit(false);
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              Code Sandboxes
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-lime-500/20 text-lime-400 border border-lime-500/30">
              Cloud IDE Engine
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Provision, scale, and govern cloud-based VS Code development sandboxes for your team and clients.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg"
          style={{
            backgroundColor: "var(--color-rp-accent)",
            color: "#000000",
            boxShadow: "0 0 20px rgba(163, 230, 53, 0.25)",
          }}
        >
          <Plus className="w-4 h-4" />
          <span>New Code Sandbox</span>
        </button>
      </div>

      {/* ── METRIC STATS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>
              Total Sandboxes
            </span>
            <Code2 className="w-4 h-4 text-lime-400" />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>{stats.total}</p>
          <span className="text-xs text-lime-400 font-medium">{stats.running} running now</span>
        </div>

        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>
              Live Cloud IDEs
            </span>
            <Play className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>{stats.running}</p>
          <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Active developer containers</span>
        </div>

        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>
              Stopped / Hibernating
            </span>
            <Square className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>{stats.stopped}</p>
          <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>0% idle compute usage</span>
        </div>

        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>
              Active Users
            </span>
            <Laptop className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>{stats.uniqueUsers}</p>
          <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Developers with access</span>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-rp-text-dim)" }} />
          <input
            type="text"
            placeholder="Search sandboxes by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none border"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={nodeFilter}
            onChange={e => setNodeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none border"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          >
            <option value="">All Compute Nodes</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none border"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          >
            <option value="">All Statuses</option>
            <option value="RUNNING">Running</option>
            <option value="STOPPED">Stopped</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button
            onClick={load}
            className="p-2 rounded-lg border transition-all"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── SANDBOXES TABLE ── */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-dim)" }}>
              <th className="py-3 px-4 font-semibold text-xs uppercase">Sandbox Name &amp; Runtime</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase">Owner</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase">Status</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase">Resources</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase">Time Limit / Idle Policy</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase">Web IDE Port</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && sandboxes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-lime-400" />
                  <p className="text-xs mt-2" style={{ color: "var(--color-rp-text-muted)" }}>Loading Code Sandboxes...</p>
                </td>
              </tr>
            ) : sandboxes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Code2 className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>No Code Sandboxes Found</p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                    Click &quot;New Code Sandbox&quot; to provision a cloud VS Code workspace for any user.
                  </p>
                </td>
              </tr>
            ) : (
              sandboxes.map(s => {
                const primaryAlloc = s.allocations?.[0];
                const idePort = primaryAlloc?.port || 25590;
                const nodeFqdn = s.node?.fqdn || "localhost";
                const ideUrl = `http://${nodeFqdn}:${idePort}`;
                const isRunning = s.status === "RUNNING";

                return (
                  <tr
                    key={s.id}
                    className="border-b transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  >
                    {/* Name & Runtime */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: "rgba(163, 230, 53, 0.1)",
                            borderColor: "rgba(163, 230, 53, 0.25)",
                            color: "var(--color-rp-accent)",
                          }}
                        >
                          <Code2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>
                            {s.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {s.sandboxRuntime || "fullstack"}
                            </span>
                            <span className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                              {s.node?.name || "Unassigned"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-sm" style={{ color: "var(--color-rp-text)" }}>
                        {s.owner?.username || "—"}
                      </p>
                      <p className="text-xs truncate max-w-[150px]" style={{ color: "var(--color-rp-text-dim)" }}>
                        {s.owner?.email || ""}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={s.suspended ? "SUSPENDED" : s.status} />
                    </td>

                    {/* Resources */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs space-y-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                        <div><strong className="text-zinc-200">{(s.ram / 1024).toFixed(1)} GB</strong> RAM · {s.cpu}% CPU</div>
                        <div>{(s.disk / 1024).toFixed(1)} GB Storage</div>
                      </div>
                    </td>

                    {/* Time Quota & Auto-Shutdown */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-medium" style={{ color: s.sandboxDailyHoursLimit ? "#38bdf8" : "#a3e635" }}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {s.sandboxDailyHoursLimit ? `${s.sandboxDailyHoursLimit}h / day limit` : "Unlimited Usage"}
                          </span>
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                          {s.sandboxAutoShutdownMinutes ? `Auto-shutdown after ${s.sandboxAutoShutdownMinutes}m idle` : "No auto-shutdown"}
                        </div>
                      </div>
                    </td>

                    {/* Port & Launch */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-lime-400">
                          :{idePort}
                        </span>
                        {isRunning && (
                          <a
                            href={ideUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-xs font-semibold hover:bg-sky-500/25 transition-all"
                            title="Open VS Code in new tab"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Launch IDE</span>
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Power controls */}
                        {isRunning ? (
                          <button
                            onClick={() => handlePower(s.id, "stop")}
                            disabled={actionLoading === s.id}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Stop Sandbox Container"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePower(s.id, "start")}
                            disabled={actionLoading === s.id}
                            className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                            title="Start Sandbox Container"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setEditingSandbox(s)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          title="Edit Sandbox Settings"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete Code Sandbox"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── CREATE SANDBOX MODAL (4-STEP WIZARD) ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "#0e1015", borderColor: "var(--color-rp-border)" }}
          >
            {/* Modal Header */}
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-rp-border)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-lime-400" />
                  <h2 className="text-lg font-bold text-white">Create Cloud Code Sandbox</h2>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Step {step} of 4 · Configure cloud development workspace
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm">
                  {createError}
                </div>
              )}

              {/* STEP 1: Basic Identity & Target User */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Sandbox Name</label>
                    <input
                      type="text"
                      placeholder="e.g. react-fullstack-dev, python-ai-lab"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Assign to User / Developer</label>
                    <select
                      value={form.ownerId}
                      onChange={e => setForm({ ...form, ownerId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                    >
                      <option value="">Select User</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Compute Node</label>
                    <select
                      value={form.nodeId}
                      onChange={e => setForm({ ...form, nodeId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                    >
                      <option value="">Select Node</option>
                      {nodes.map(n => (
                        <option key={n.id} value={n.id} disabled={n.maintenanceMode}>
                          {n.name} ({n.fqdn}) {n.maintenanceMode ? "— [Maintenance]" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 2: Runtime Environment */}
              {step === 2 && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Select Development Stack &amp; Runtime
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {RUNTIMES.map(r => {
                      const Icon = r.icon;
                      const isSelected = form.sandboxRuntime === r.id;
                      return (
                        <div
                          key={r.id}
                          onClick={() => setForm({ ...form, sandboxRuntime: r.id })}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-lime-500/10 border-lime-500 text-white shadow-lg shadow-lime-500/10"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isSelected ? "text-lime-400" : "text-zinc-400"}`} />
                            <span className="font-semibold text-sm text-white">{r.name}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">{r.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  {form.sandboxRuntime === "custom" && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Custom Docker Image
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. lscr.io/linuxserver/code-server:latest"
                        value={form.customDockerImage}
                        onChange={e => setForm({ ...form, customDockerImage: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Resources & Port Mapping */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">RAM (MB)</label>
                      <input
                        type="number"
                        min="512"
                        step="512"
                        value={form.ram}
                        onChange={e => setForm({ ...form, ram: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">CPU Limit (%)</label>
                      <input
                        type="number"
                        min="25"
                        step="25"
                        value={form.cpu}
                        onChange={e => setForm({ ...form, cpu: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">Disk (MB)</label>
                      <input
                        type="number"
                        min="1024"
                        step="1024"
                        value={form.disk}
                        onChange={e => setForm({ ...form, disk: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Specific Host Port (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 25590 (leave blank to auto-allocate from node)"
                      value={form.specificPorts}
                      onChange={e => setForm({ ...form, specificPorts: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Web IDE Access Password (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Leave blank for passwordless browser login"
                        value={form.sandboxPassword}
                        onChange={e => setForm({ ...form, sandboxPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Time Limit & Auto-Shutdown Policy */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Daily Usage Time Limit
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Unlimited", val: "0" },
                        { label: "2 Hrs / Day", val: "2" },
                        { label: "5 Hrs / Day", val: "5" },
                        { label: "8 Hrs / Day", val: "8" },
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setForm({ ...form, sandboxDailyHoursLimit: opt.val })}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                            form.sandboxDailyHoursLimit === opt.val
                              ? "bg-lime-500/15 border-lime-500 text-lime-400"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Inactivity Auto-Shutdown Timer
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Never", val: "0" },
                        { label: "15 Mins", val: "15" },
                        { label: "30 Mins", val: "30" },
                        { label: "60 Mins", val: "60" },
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setForm({ ...form, sandboxAutoShutdownMinutes: opt.val })}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                            form.sandboxAutoShutdownMinutes === opt.val
                              ? "bg-lime-500/15 border-lime-500 text-lime-400"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1.5">
                      Automatically stops the container when no developer activity is detected to save RAM and compute quotas.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Sandbox Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={form.expiresAt}
                        onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Grace Period (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.gracePeriodDays}
                        onChange={e => setForm({ ...form, gracePeriodDays: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none border bg-zinc-900 border-zinc-800 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex items-center justify-between bg-zinc-950/60" style={{ borderColor: "var(--color-rp-border)" }}>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
                >
                  Back
                </button>
              ) : <div />}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && (!form.name.trim() || !form.ownerId || !form.nodeId)}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-lime-400 text-black hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateSandbox}
                  disabled={creating}
                  className="px-6 py-2 rounded-lg text-xs font-bold bg-lime-400 text-black hover:bg-lime-300 flex items-center gap-2 shadow-lg shadow-lime-400/20"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code2 className="w-4 h-4" />}
                  <span>{creating ? "Provisioning Sandbox..." : "Provision Code Sandbox"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SANDBOX MODAL ── */}
      {editingSandbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border p-6 bg-zinc-900 border-zinc-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">Edit Code Sandbox: {editingSandbox.name}</h3>
              <button onClick={() => setEditingSandbox(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Sandbox Name</label>
                <input
                  type="text"
                  value={editingSandbox.name}
                  onChange={e => setEditingSandbox({ ...editingSandbox, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">RAM (MB)</label>
                  <input
                    type="number"
                    value={editingSandbox.ram}
                    onChange={e => setEditingSandbox({ ...editingSandbox, ram: parseInt(e.target.value) || 2048 })}
                    className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">CPU (%)</label>
                  <input
                    type="number"
                    value={editingSandbox.cpu}
                    onChange={e => setEditingSandbox({ ...editingSandbox, cpu: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Disk (MB)</label>
                  <input
                    type="number"
                    value={editingSandbox.disk}
                    onChange={e => setEditingSandbox({ ...editingSandbox, disk: parseInt(e.target.value) || 10240 })}
                    className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Daily Hours Limit (0 = unltd)</label>
                  <input
                    type="number"
                    value={editingSandbox.sandboxDailyHoursLimit || 0}
                    onChange={e => setEditingSandbox({ ...editingSandbox, sandboxDailyHoursLimit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Idle Auto-Shutdown (Mins)</label>
                  <input
                    type="number"
                    value={editingSandbox.sandboxAutoShutdownMinutes || 0}
                    onChange={e => setEditingSandbox({ ...editingSandbox, sandboxAutoShutdownMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Web IDE Password</label>
                <input
                  type="text"
                  placeholder="Leave empty for no password"
                  value={editingSandbox.sandboxPassword || ""}
                  onChange={e => setEditingSandbox({ ...editingSandbox, sandboxPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-zinc-950 border-zinc-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingSandbox(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-lime-400 text-black hover:bg-lime-300"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 bg-zinc-900 border-zinc-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">Terminate Code Sandbox?</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{deleteTarget.name}&quot;</strong>?
              This will destroy the workspace container and release all allocated ports immediately.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-500"
              >
                {deleting ? "Deleting..." : "Confirm Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SandboxesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading Code Sandboxes...</div>}>
      <SandboxesContent />
    </Suspense>
  );
}
