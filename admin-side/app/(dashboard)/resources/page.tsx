"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles, Plus, Search, RefreshCw, Layers, Cpu, HardDrive,
  Server, Shield, Calendar, Clock, AlertTriangle, Check, X,
  Loader2, Trash2, Pencil, ShieldAlert, Zap, PauseCircle, PlayCircle,
  TrendingUp, ArrowRight, User as UserIcon
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/Badge";

interface QuotaItem {
  id: string;
  userId: string;
  name: string;
  maxRam: number;
  maxCpu: number;
  maxDisk: number;
  maxServers: number;
  maxBackups: number;
  maxAllocations: number;
  allowServerCreation: boolean;
  isSuspended: boolean;
  suspendedReason?: string | null;
  expiresAt?: string | null;
  gracePeriodDays: number;
  onExpireAction: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  usedRam: number;
  usedCpu: number;
  usedDisk: number;
  serverCount: number;
  remainingRam: number;
  remainingCpu: number;
  remainingDisk: number;
  remainingServers: number;
  isExpired: boolean;
  isInGracePeriod: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
  };
}

interface UserSummary {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  hasQuota: boolean;
  serverCount: number;
}

const EMPTY_QUOTA_FORM = {
  userId: "",
  name: "Standard Resource Package",
  maxRamGb: "8",
  maxCpu: "200",
  maxDiskGb: "50",
  maxServers: "3",
  maxBackups: "5",
  maxAllocations: "3",
  allowServerCreation: false,
  expiresAt: "",
  gracePeriodDays: "3",
  onExpireAction: "SUSPEND_SERVERS",
  notes: "",
};

export default function ResourcesPage() {
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_QUOTA_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lifecycleRunning, setLifecycleRunning] = useState(false);
  const [lifecycleResult, setLifecycleResult] = useState<any>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [suspendServersOnDelete, setSuspendServersOnDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resources");
      if (res.ok) {
        const data = await res.json();
        setQuotas(data.quotas || []);
        setUsers(data.users || []);
      }
    } catch {
      setError("Failed to load user resource pools.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditId(null);
    const availableUser = users.find((u) => !u.hasQuota);
    setForm({
      ...EMPTY_QUOTA_FORM,
      userId: availableUser?.id || users[0]?.id || "",
    });
    setError("");
    setModalOpen(true);
  }

  function openEdit(q: QuotaItem) {
    setEditId(q.id);
    setForm({
      userId: q.userId,
      name: q.name,
      maxRamGb: String(Math.round(q.maxRam / 1024)),
      maxCpu: String(q.maxCpu),
      maxDiskGb: String(Math.round(q.maxDisk / 1024)),
      maxServers: String(q.maxServers),
      maxBackups: String(q.maxBackups),
      maxAllocations: String(q.maxAllocations),
      allowServerCreation: q.allowServerCreation,
      expiresAt: q.expiresAt ? new Date(q.expiresAt).toISOString().split("T")[0] : "",
      gracePeriodDays: String(q.gracePeriodDays),
      onExpireAction: q.onExpireAction,
      notes: q.notes || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSaveQuota() {
    if (!form.userId) {
      setError("Please select a target user.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      userId: form.userId,
      name: form.name,
      maxRam: Math.max(128, parseInt(form.maxRamGb) * 1024),
      maxCpu: Math.max(10, parseInt(form.maxCpu)),
      maxDisk: Math.max(512, parseInt(form.maxDiskGb) * 1024),
      maxServers: Math.max(1, parseInt(form.maxServers)),
      maxBackups: Math.max(0, parseInt(form.maxBackups)),
      maxAllocations: Math.max(0, parseInt(form.maxAllocations)),
      allowServerCreation: form.allowServerCreation,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      gracePeriodDays: Math.max(0, parseInt(form.gracePeriodDays)),
      onExpireAction: form.onExpireAction,
      notes: form.notes,
    };

    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setModalOpen(false);
        setSuccess(editId ? "Resource pool updated successfully." : "User resource quota granted successfully.");
        loadData();
      } else {
        setError(data.error || "Failed to save resource quota.");
      }
    } catch {
      setError("Network error saving resource quota.");
    }
    setSaving(false);
  }

  async function toggleSuspend(q: QuotaItem) {
    try {
      const res = await fetch(`/api/admin/resources/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isSuspended: !q.isSuspended,
          suspendedReason: !q.isSuspended ? "ADMIN_SUSPENDED" : null,
        }),
      });
      if (res.ok) {
        loadData();
      }
    } catch {}
  }

  async function handleDeleteQuota() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/resources/${deleteConfirmId}?suspendServers=${suspendServersOnDelete}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirmId(null);
        setSuccess("Resource quota revoked.");
        loadData();
      }
    } catch {}
    setDeleting(false);
  }

  async function runLifecycleProcessor() {
    setLifecycleRunning(true);
    try {
      const res = await fetch("/api/admin/lifecycle/process", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLifecycleResult(data.summary);
        loadData();
      }
    } catch {}
    setLifecycleRunning(false);
  }

  const filteredQuotas = quotas.filter((q) => {
    const term = search.toLowerCase();
    return (
      q.user.email.toLowerCase().includes(term) ||
      q.user.username.toLowerCase().includes(term) ||
      q.name.toLowerCase().includes(term)
    );
  });

  const totalGrantedRam = quotas.reduce((acc, q) => acc + q.maxRam, 0);
  const totalUsedRam = quotas.reduce((acc, q) => acc + q.usedRam, 0);
  const totalGrantedDisk = quotas.reduce((acc, q) => acc + q.maxDisk, 0);
  const totalUsedDisk = quotas.reduce((acc, q) => acc + q.usedDisk, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              Account Resource Quotas &amp; Pools
            </h1>
            <Badge variant="info">Enterprise</Badge>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Grant dedicated RAM, CPU, Disk, and server slots to user accounts with automated expiration and scaling control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runLifecycleProcessor}
            disabled={lifecycleRunning}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{
              borderColor: "var(--color-rp-border)",
              backgroundColor: "var(--color-rp-surface)",
              color: "var(--color-rp-text)",
            }}
            title="Evaluate server and quota expirations"
          >
            <Clock className={`w-3.5 h-3.5 ${lifecycleRunning ? "animate-spin text-purple-400" : ""}`} />
            <span>{lifecycleRunning ? "Evaluating..." : "Run Lifecycle Check"}</span>
          </button>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
          >
            <Plus className="w-4 h-4" />
            <span>Grant User Resources</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--color-rp-text-muted)" }}>Total Quota Pools</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold" style={{ color: "var(--color-rp-text)" }}>
            {quotas.length}
          </div>
          <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
            {quotas.filter((q) => !q.isSuspended && !q.isExpired).length} active, {quotas.filter((q) => q.isSuspended).length} suspended
          </span>
        </div>

        <div className="p-4 rounded-2xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--color-rp-text-muted)" }}>Allotted Memory (RAM)</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold" style={{ color: "var(--color-rp-text)" }}>
            {(totalUsedRam / 1024).toFixed(1)} <span className="text-sm font-normal text-zinc-500">/ {(totalGrantedRam / 1024).toFixed(1)} GB</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/40 mt-2">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalGrantedRam > 0 ? (totalUsedRam / totalGrantedRam) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--color-rp-text-muted)" }}>Allotted NVMe Disk</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold" style={{ color: "var(--color-rp-text)" }}>
            {(totalUsedDisk / 1024).toFixed(1)} <span className="text-sm font-normal text-zinc-500">/ {(totalGrantedDisk / 1024).toFixed(1)} GB</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/40 mt-2">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalGrantedDisk > 0 ? (totalUsedDisk / totalGrantedDisk) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--color-rp-text-muted)" }}>Creation Enabled</span>
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold" style={{ color: "var(--color-rp-text)" }}>
            {quotas.filter((q) => q.allowServerCreation).length} <span className="text-sm font-normal text-zinc-500">users</span>
          </div>
          <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
            Permitted to self-provision servers
          </span>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-3 rounded-xl border flex items-center justify-between text-xs" style={{ backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)", color: "#34d399" }}>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {lifecycleResult && (
        <div className="p-3 rounded-xl border text-xs" style={{ backgroundColor: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
          Lifecycle Check: Suspended {lifecycleResult.serversSuspended} expired servers, processed {lifecycleResult.quotasExpired} expired quotas.
        </div>
      )}

      {/* Search and Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>
        <div className="p-4 border-b flex items-center justify-between gap-4" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-rp-text-dim)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user email, username, or pool name..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border text-xs outline-none"
              style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
            />
          </div>

          <button onClick={loadData} className="p-2 rounded-xl border" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "var(--color-rp-accent)" }} />
            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Loading user resource allocations...</p>
          </div>
        ) : filteredQuotas.length === 0 ? (
          <div className="py-16 text-center">
            <Layers className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-rp-text-dim)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>No resource quotas configured</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
              Assign resource allotments to accounts so users can scale their instances.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>User Account</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>Memory (RAM)</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>Storage (Disk)</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>CPU</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>Servers</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>Self-Creation</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-rp-text-dim)" }}>Expiration</th>
                  <th className="px-4 py-3 font-semibold text-right" style={{ color: "var(--color-rp-text-dim)" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {filteredQuotas.map((q) => {
                  const ramPct = Math.min(100, Math.round((q.usedRam / q.maxRam) * 100));
                  const diskPct = Math.min(100, Math.round((q.usedDisk / q.maxDisk) * 100));

                  return (
                    <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-accent)" }}>
                            {q.user.username[0]?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <span className="font-semibold block" style={{ color: "var(--color-rp-text)" }}>
                              {q.user.email}
                            </span>
                            <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                              {q.user.username} &bull; <span className="font-mono text-purple-400">{q.name}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium" style={{ color: "var(--color-rp-text)" }}>
                            {(q.usedRam / 1024).toFixed(1)} / {(q.maxRam / 1024).toFixed(0)} GB
                          </span>
                          <div className="w-24 h-1.5 rounded-full overflow-hidden bg-black/40 mt-1">
                            <div className={`h-full rounded-full ${ramPct > 90 ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${ramPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium" style={{ color: "var(--color-rp-text)" }}>
                            {(q.usedDisk / 1024).toFixed(1)} / {(q.maxDisk / 1024).toFixed(0)} GB
                          </span>
                          <div className="w-24 h-1.5 rounded-full overflow-hidden bg-black/40 mt-1">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${diskPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono font-medium" style={{ color: "var(--color-rp-text)" }}>
                          {q.usedCpu}% / {q.maxCpu}%
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: "var(--color-rp-text)" }}>
                          {q.serverCount} / {q.maxServers}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {q.allowServerCreation ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            ENABLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/10 text-zinc-400">
                            Scale-Only
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {q.isSuspended ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400">
                            SUSPENDED
                          </span>
                        ) : q.isInGracePeriod ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400">
                            GRACE PERIOD ({q.gracePeriodDays}d)
                          </span>
                        ) : q.expiresAt ? (
                          <span className="text-[11px] font-mono" style={{ color: "var(--color-rp-text-muted)" }}>
                            {new Date(q.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                            Lifetime / No Expiry
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleSuspend(q)}
                            title={q.isSuspended ? "Unsuspend Quota" : "Freeze Quota"}
                            className="p-1.5 rounded-lg border text-xs"
                            style={{
                              borderColor: "var(--color-rp-border)",
                              color: q.isSuspended ? "var(--color-rp-green)" : "var(--color-rp-yellow)",
                            }}
                          >
                            {q.isSuspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => openEdit(q)}
                            title="Edit Resource Allotment"
                            className="p-1.5 rounded-lg border text-xs"
                            style={{ borderColor: "var(--color-rp-border)", color: "#60a5fa" }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmId(q.id)}
                            title="Revoke Quota Pool"
                            className="p-1.5 rounded-lg border text-xs"
                            style={{ borderColor: "var(--color-rp-border)", color: "#f87171" }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Grant / Edit Resource Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/15 text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: "var(--color-rp-text)" }}>
                    {editId ? "Edit Account Resource Quota" : "Grant Account Resource Pool"}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                    Configure dedicated memory, disk, and self-provisioning permissions for user accounts
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ color: "var(--color-rp-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 rounded-lg text-xs flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* User Selection */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Target User Account
                </label>
                {editId ? (
                  <input
                    type="text"
                    disabled
                    value={users.find((u) => u.id === form.userId)?.email || form.userId}
                    className="w-full h-10 px-3 rounded-xl border text-xs opacity-60 font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}
                  />
                ) : (
                  <select
                    value={form.userId}
                    onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email} ({u.username}) {u.hasQuota ? "— [Already has quota]" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Pool Name */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Package / Plan Label
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. VIP Gamer Pool, Node Tier 2, Custom Plan"
                  className="w-full h-10 px-3 rounded-xl border text-xs outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              {/* Resource Allotments Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                    Total RAM (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxRamGb}
                    onChange={(e) => setForm((f) => ({ ...f, maxRamGb: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>
                    = {parseInt(form.maxRamGb || "0") * 1024} MB
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                    Total Disk (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxDiskGb}
                    onChange={(e) => setForm((f) => ({ ...f, maxDiskGb: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>
                    = {parseInt(form.maxDiskGb || "0") * 1024} MB
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                    Total CPU (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="50"
                    value={form.maxCpu}
                    onChange={(e) => setForm((f) => ({ ...f, maxCpu: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>
                    100% = 1 Full Core
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                    Max Server Slots
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxServers}
                    onChange={(e) => setForm((f) => ({ ...f, maxServers: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                    Max Backups / Server
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxBackups}
                    onChange={(e) => setForm((f) => ({ ...f, maxBackups: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                    Extra Port Allocations
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxAllocations}
                    onChange={(e) => setForm((f) => ({ ...f, maxAllocations: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border text-xs outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>
              </div>

              {/* Allow Server Creation Toggle */}
              <div
                className="flex items-center justify-between p-4 rounded-xl border"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-yellow-500/10 text-yellow-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block" style={{ color: "var(--color-rp-text)" }}>
                      Allow Server Self-Creation using Resource Quota
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                      When enabled, user can provision new servers directly from their user panel within this resource pool.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={form.allowServerCreation}
                  onClick={() => setForm((f) => ({ ...f, allowServerCreation: !f.allowServerCreation }))}
                  className="shrink-0 relative rounded-full transition-all duration-200 ease-out focus:outline-none cursor-pointer select-none"
                  style={{
                    width: "44px",
                    height: "24px",
                    backgroundColor: form.allowServerCreation ? "var(--color-rp-accent)" : "rgba(255, 255, 255, 0.15)",
                    boxShadow: form.allowServerCreation ? "0 0 10px var(--color-rp-accent-glow)" : "none",
                  }}
                >
                  <span
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-200 ease-out shadow-sm"
                    style={{
                      width: "18px",
                      height: "18px",
                      left: form.allowServerCreation ? "23px" : "3px",
                    }}
                  />
                </button>
              </div>

              {/* Expiry & Lifecycle Billing Controls */}
              <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                <span className="text-xs font-bold block" style={{ color: "var(--color-rp-text)" }}>
                  Billing Lifecycle, Expiration &amp; Suspension Policies
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--color-rp-text-dim)" }}>
                      Expiration / Renewal Date
                    </label>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
                      style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--color-rp-text-dim)" }}>
                      Grace Period (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.gracePeriodDays}
                      onChange={(e) => setForm((f) => ({ ...f, gracePeriodDays: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
                      style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--color-rp-text-dim)" }}>
                      Action on Expiry
                    </label>
                    <select
                      value={form.onExpireAction}
                      onChange={(e) => setForm((f) => ({ ...f, onExpireAction: e.target.value }))}
                      className="w-full h-9 px-2 rounded-lg border text-xs outline-none"
                      style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    >
                      <option value="SUSPEND_SERVERS">Suspend User Servers</option>
                      <option value="FREEZE_SCALE">Freeze Resource Scaling</option>
                      <option value="NOTIFY_ONLY">Notify Only (No Freeze)</option>
                      <option value="DELETE_SERVERS">Auto-Delete Servers</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 border-t flex items-center justify-between"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}
            >
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 h-9 rounded-xl text-xs border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                Cancel
              </button>

              <button
                onClick={handleSaveQuota}
                disabled={saving}
                className="flex items-center gap-2 px-5 h-9 rounded-xl text-xs font-bold disabled:opacity-50"
                style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="w-3.5 h-3.5" /> {editId ? "Save Changes" : "Grant Quota Pool"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border shadow-xl overflow-hidden" style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>
            <div className="p-5 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
              <h3 className="font-bold text-base text-red-400">Revoke Resource Quota</h3>
              <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                This will remove the allocated resource pool from the user.
              </p>
            </div>

            <div className="p-5 space-y-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-rp-text)" }}>
                <input
                  type="checkbox"
                  checked={suspendServersOnDelete}
                  onChange={(e) => setSuspendServersOnDelete(e.target.checked)}
                  className="rounded accent-red-500"
                />
                <span>Also suspend user servers currently relying on this quota pool</span>
              </label>
            </div>

            <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 h-8 rounded-lg text-xs border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQuota}
                disabled={deleting}
                className="px-4 h-8 rounded-lg text-xs font-bold bg-red-600 text-white"
              >
                {deleting ? "Revoking..." : "Revoke Quota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
