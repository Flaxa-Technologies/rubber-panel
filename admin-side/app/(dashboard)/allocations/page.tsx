"use client";

import { useEffect, useState } from "react";
import { 
  Network, Plus, Trash2, RefreshCw, Server, CheckCircle2, 
  Circle, Ban, Power, Search, Filter, Layers, Copy, Check, AlertTriangle, Loader2 
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface Allocation {
  id: string;
  ip: string;
  port: number;
  alias: string | null;
  assigned: boolean;
  disabled: boolean;
  server: { id: string; name: string } | null;
  node: { id: string; name: string; fqdn: string } | null;
}

interface Node { id: string; name: string; fqdn: string; }

export default function PortManagementPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [mode, setMode] = useState<"bulk" | "single">("bulk");
  const [form, setForm] = useState({ nodeId: "", ip: "", portStart: "", portEnd: "", singlePort: "", alias: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [filterNode, setFilterNode] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "assigned" | "disabled">("all");
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [allocRes, nodeRes] = await Promise.all([
        fetch("/api/admin/allocations"),
        fetch("/api/admin/nodes"),
      ]);
      if (allocRes.ok) {
        const d = await allocRes.json();
        setAllocations(d.allocations ?? []);
      }
      if (nodeRes.ok) {
        const d = await nodeRes.json();
        const nList: Node[] = d.nodes ?? [];
        setNodes(nList);
        if (nList.length > 0 && !form.nodeId) {
          setForm(f => ({ ...f, nodeId: nList[0].id, ip: nList[0].fqdn || "0.0.0.0" }));
        }
      }
    } catch {
      setError("Failed to load ports");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createAllocations(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); 
    setError("");

    const payload = mode === "bulk" ? {
      nodeId: form.nodeId,
      ip: form.ip,
      portStart: parseInt(form.portStart),
      portEnd: parseInt(form.portEnd),
    } : {
      nodeId: form.nodeId,
      ip: form.ip,
      port: parseInt(form.singlePort),
      alias: form.alias || undefined,
    };

    try {
      const res = await fetch("/api/admin/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm(f => ({ ...f, portStart: "", portEnd: "", singlePort: "", alias: "" }));
        await load();
      } else {
        const d = await res.json();
        setError(d.error ?? "Failed to create port allocations");
      }
    } catch {
      setError("Network error while creating allocations");
    }
    setCreating(false);
  }

  async function togglePortDisabled(alloc: Allocation) {
    setTogglingId(alloc.id);
    const newDisabled = !alloc.disabled;
    try {
      const res = await fetch("/api/admin/allocations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alloc.id, disabled: newDisabled }),
      });
      if (res.ok) {
        setAllocations(prev => prev.map(a => a.id === alloc.id ? { ...a, disabled: newDisabled } : a));
      }
    } catch {
      alert("Failed to update port status");
    }
    setTogglingId(null);
  }

  async function deleteAllocation(id: string) {
    if (!confirm("Are you sure you want to delete this port allocation?")) return;
    const res = await fetch(`/api/admin/allocations?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setAllocations(a => a.filter(x => x.id !== id));
    } else {
      const d = await res.json();
      alert(d.error || "Failed to delete allocation");
    }
  }

  const copyPort = async (text: string, id: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = allocations.filter(a => {
    if (filterNode && a.node?.id !== filterNode) return false;
    if (filterStatus === "assigned" && !a.assigned) return false;
    if (filterStatus === "available" && (a.assigned || a.disabled)) return false;
    if (filterStatus === "disabled" && !a.disabled) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchPort = a.port.toString().includes(q);
      const matchIp = a.ip.toLowerCase().includes(q);
      const matchServer = a.server?.name.toLowerCase().includes(q);
      const matchNode = a.node?.name.toLowerCase().includes(q);
      if (!matchPort && !matchIp && !matchServer && !matchNode) return false;
    }
    return true;
  });

  const totalCount = allocations.length;
  const assignedCount = allocations.filter(a => a.assigned).length;
  const disabledCount = allocations.filter(a => a.disabled).length;
  const availableCount = allocations.filter(a => !a.assigned && !a.disabled).length;

  return (
    <div className="space-y-5 w-full animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>
            Port Management
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Manage node network bindings, assign ports, and disable reserved ranges from auto-assignment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={load} 
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-white/5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button 
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-transform active:scale-95"
            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
          >
            <Plus className="w-4 h-4" /> Add Ports
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-rp-text-dim)" }}>Total Ports</div>
          <div className="text-2xl font-bold mt-1" style={{ color: "var(--color-rp-text)" }}>{totalCount}</div>
        </div>

        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-rp-green)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Available</span>
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: "var(--color-rp-green)" }}>{availableCount}</div>
        </div>

        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-rp-text-muted)" }}>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Assigned</span>
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: "var(--color-rp-text)" }}>{assignedCount}</div>
        </div>

        <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-rp-red)" }}>
            <Ban className="w-3.5 h-3.5 text-rose-500" />
            <span>Disabled / Blocked</span>
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: "var(--color-rp-red)" }}>{disabledCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Node dropdown */}
          <select
            value={filterNode}
            onChange={(e) => setFilterNode(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border outline-none font-medium"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          >
            <option value="">All Nodes ({nodes.length})</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name} ({n.fqdn})</option>
            ))}
          </select>

          {/* Status buttons */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border" style={{ borderColor: "var(--color-rp-border)" }}>
            {[
              { id: "all", label: "All" },
              { id: "available", label: "Available" },
              { id: "assigned", label: "Assigned" },
              { id: "disabled", label: "Disabled" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as any)}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                style={filterStatus === tab.id ? { backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" } : { color: "var(--color-rp-text-muted)" }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5" style={{ color: "var(--color-rp-text-dim)" }} />
          <input
            type="text"
            placeholder="Search port, IP, server..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border outline-none"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          />
        </div>
      </div>

      {/* Ports Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
              <th className="font-semibold p-3.5">Port & IP</th>
              <th className="font-semibold p-3.5">Node</th>
              <th className="font-semibold p-3.5">Status</th>
              <th className="font-semibold p-3.5">Assigned Instance</th>
              <th className="font-semibold p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--color-rp-accent)" }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
                  No ports match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((alloc) => {
                const isToggling = togglingId === alloc.id;
                return (
                  <tr 
                    key={alloc.id} 
                    className="border-b last:border-0 hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold" style={{ color: alloc.disabled ? "var(--color-rp-text-dim)" : "var(--color-rp-text)" }}>
                          {alloc.port}
                        </span>
                        <span className="text-xs font-mono" style={{ color: "var(--color-rp-text-dim)" }}>
                          ({alloc.ip})
                        </span>
                        <button 
                          onClick={() => copyPort(`${alloc.ip}:${alloc.port}`, alloc.id)} 
                          className="text-muted hover:text-white p-1 rounded"
                          title="Copy address"
                        >
                          {copiedId === alloc.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5 text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
                      {alloc.node?.name ?? "—"}
                    </td>

                    <td className="p-3.5">
                      {alloc.disabled ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--color-rp-red)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <Ban className="w-3 h-3" /> Disabled
                        </span>
                      ) : alloc.assigned ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
                          <CheckCircle2 className="w-3 h-3" /> Assigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "var(--color-rp-green)", border: "1px solid rgba(16,185,129,0.2)" }}>
                          <Circle className="w-2 h-2 fill-current" /> Available
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-xs">
                      {alloc.server ? (
                        <a 
                          href={`/servers/${alloc.server.id}`}
                          className="font-medium hover:underline inline-flex items-center gap-1.5"
                          style={{ color: "var(--color-rp-accent)" }}
                        >
                          <Server className="w-3 h-3" />
                          {alloc.server.name}
                        </a>
                      ) : (
                        <span style={{ color: "var(--color-rp-text-dim)" }}>Unassigned</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle Disable / Enable Button */}
                        <button
                          onClick={() => togglePortDisabled(alloc)}
                          disabled={isToggling || alloc.assigned}
                          title={alloc.assigned ? "Assigned ports cannot be disabled" : alloc.disabled ? "Enable this port for assignment" : "Disable this port from auto-assignment"}
                          className="px-2.5 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          style={
                            alloc.disabled 
                              ? { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)", color: "var(--color-rp-green)" }
                              : { backgroundColor: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)", color: "var(--color-rp-red)" }
                          }
                        >
                          {isToggling ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : alloc.disabled ? (
                            "Enable"
                          ) : (
                            "Disable"
                          )}
                        </button>

                        {/* Delete button (only for unassigned) */}
                        {!alloc.assigned && (
                          <button
                            onClick={() => deleteAllocation(alloc.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                            title="Delete port allocation"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Ports Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div 
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--color-rp-text)" }}>
                  Add Port Allocations
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                  Register available network ports to nodes.
                </p>
              </div>
              <div className="flex bg-black/40 p-1 rounded-lg border" style={{ borderColor: "var(--color-rp-border)" }}>
                <button
                  type="button"
                  onClick={() => setMode("bulk")}
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={mode === "bulk" ? { backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" } : { color: "var(--color-rp-text-muted)" }}
                >
                  Port Range
                </button>
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className="px-3 py-1 rounded text-xs font-medium"
                  style={mode === "single" ? { backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" } : { color: "var(--color-rp-text-muted)" }}
                >
                  Single Port
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={createAllocations} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-muted)" }}>
                  Target Node
                </label>
                <select
                  value={form.nodeId}
                  onChange={(e) => {
                    const sel = nodes.find(n => n.id === e.target.value);
                    setForm(f => ({ ...f, nodeId: e.target.value, ip: sel?.fqdn || "0.0.0.0" }));
                  }}
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                >
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.name} ({n.fqdn})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-muted)" }}>
                  IP Address
                </label>
                <input
                  type="text"
                  value={form.ip}
                  onChange={(e) => setForm(f => ({ ...f, ip: e.target.value }))}
                  required
                  placeholder="0.0.0.0 or node IP"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              {mode === "bulk" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-muted)" }}>
                      Start Port
                    </label>
                    <input
                      type="number"
                      value={form.portStart}
                      onChange={(e) => setForm(f => ({ ...f, portStart: e.target.value }))}
                      required
                      min={1024}
                      max={65535}
                      placeholder="25566"
                      className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-muted)" }}>
                      End Port
                    </label>
                    <input
                      type="number"
                      value={form.portEnd}
                      onChange={(e) => setForm(f => ({ ...f, portEnd: e.target.value }))}
                      required
                      min={1024}
                      max={65535}
                      placeholder="25665"
                      className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-muted)" }}>
                    Port Number
                  </label>
                  <input
                    type="number"
                    value={form.singlePort}
                    onChange={(e) => setForm(f => ({ ...f, singlePort: e.target.value }))}
                    required
                    min={1024}
                    max={65535}
                    placeholder="25566"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                >
                  {creating ? "Creating..." : "Save Allocations"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
