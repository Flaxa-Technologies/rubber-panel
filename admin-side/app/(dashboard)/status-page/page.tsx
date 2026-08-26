"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, ShieldAlert,
  Server, MonitorSpeaker, Globe, ExternalLink, RefreshCw, Save,
  Check, X, Sliders, Sparkles, Layers, Info, Wrench, Shield,
  Eye, ToggleLeft, ToggleRight, Radio, Search, ArrowUpRight
} from "lucide-react";

interface StatusConfig {
  enabled: boolean;
  title: string;
  description: string;
  includeAdmin: boolean;
  includeUser: boolean;
  includedNodeIds: string[] | "ALL";
  customMessage: string;
  noticeType: "info" | "warning" | "maintenance";
  showNotice: boolean;
  themeAccent: "lime" | "emerald" | "cyan" | "amber" | "purple";
  companyName: string;
  supportUrl: string;
}

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
  status: string;
  isOnline: boolean;
  lastHeartbeat: string | null;
  serversCount: number;
}

export default function StatusPageManager() {
  const [config, setConfig] = useState<StatusConfig>({
    enabled: true,
    title: "Rubber Panel System Status",
    description: "Real-time service health, cluster metrics, and node heartbeat operational state.",
    includeAdmin: true,
    includeUser: true,
    includedNodeIds: "ALL",
    customMessage: "",
    noticeType: "info",
    showNotice: false,
    themeAccent: "lime",
    companyName: "Flaxa Studios",
    supportUrl: "https://discord.gg/rubberpanel",
  });

  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/status-page");
      if (res.ok) {
        const d = await res.json();
        if (d.config) setConfig(d.config);
        if (d.nodes) setNodes(d.nodes);
      } else {
        setError("Failed to fetch status page configuration.");
      }
    } catch {
      setError("Network error loading status page configuration.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSaveSuccess(false);

      const res = await fetch("/api/admin/status-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const d = await res.json();
        setError(d.error || "Failed to save settings.");
      }
    } catch {
      setError("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  }

  function handleNodeToggle(nodeId: string) {
    if (config.includedNodeIds === "ALL") {
      const allIds = nodes.map(n => n.id);
      setConfig(c => ({
        ...c,
        includedNodeIds: allIds.filter(id => id !== nodeId),
      }));
    } else {
      const current = Array.isArray(config.includedNodeIds) ? config.includedNodeIds : [];
      if (current.includes(nodeId)) {
        setConfig(c => ({
          ...c,
          includedNodeIds: current.filter(id => id !== nodeId),
        }));
      } else {
        const next = [...current, nodeId];
        if (next.length === nodes.length) {
          setConfig(c => ({ ...c, includedNodeIds: "ALL" }));
        } else {
          setConfig(c => ({ ...c, includedNodeIds: next }));
        }
      }
    }
  }

  function handleSelectAllNodes(select: boolean) {
    if (select) {
      setConfig(c => ({ ...c, includedNodeIds: "ALL" }));
    } else {
      setConfig(c => ({ ...c, includedNodeIds: [] }));
    }
  }

  function isNodeIncluded(nodeId: string): boolean {
    if (config.includedNodeIds === "ALL") return true;
    return Array.isArray(config.includedNodeIds) && config.includedNodeIds.includes(nodeId);
  }

  const onlineNodesCount = nodes.filter(n => n.isOnline).length;
  const userPortalStatusUrl = "http://localhost:3002/status";

  const filteredNodes = nodes.filter(n =>
    n.name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
    n.fqdn.toLowerCase().includes(nodeSearch.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 pb-20">
      {/* ─── FULL-WIDTH HERO BANNER ─── */}
      <div
        className="w-full rounded-2xl border p-6 md:p-8 relative overflow-hidden shadow-xl"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-lime-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10 w-full">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-lime-400">
                    Cluster Telemetry &amp; Uptime Engine
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      config.enabled
                        ? "bg-lime-400/15 text-lime-400 border-lime-400/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    {config.enabled ? "PUBLIC /status LIVE" : "DISABLED"}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
                  Status Page Manager
                </h1>
              </div>
            </div>
            <p className="text-xs md:text-sm leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
              Orchestrate the public status page hosted at <strong>/status</strong> on the User Portal.
              Control monitored services, toggle individual node daemons based on live heartbeats, broadcast maintenance alerts, and customize branding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={userPortalStatusUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm hover:border-lime-400/50"
              style={{
                backgroundColor: "var(--color-rp-surface-2)",
                borderColor: "var(--color-rp-border)",
                color: "var(--color-rp-text)",
              }}
            >
              <Eye className="w-4 h-4 text-lime-400" />
              <span>Open Public Status</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
            </a>

            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md hover:brightness-110 active:scale-95 cursor-pointer"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="w-full p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="w-full p-4 rounded-xl border border-lime-500/40 bg-lime-950/20 text-lime-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-lime-400 shrink-0" />
          <span>Status page configuration updated and synchronized across all portals!</span>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-lime-400" />
          <p className="text-xs font-semibold">Loading status page settings...</p>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* ─── LEFT COLUMN (8 COLS): CONFIGURATION ─── */}
          <div className="xl:col-span-8 space-y-6 w-full">
            {/* 1. MASTER STATUS TOGGLE */}
            <div
              className="w-full rounded-2xl border p-5 md:p-6 space-y-4"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                      Public Status Page Access
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        config.enabled
                          ? "bg-lime-400/15 text-lime-400 border-lime-400/30"
                          : "bg-red-500/15 text-red-400 border-red-500/30"
                      }`}
                    >
                      {config.enabled ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    When enabled, users and visitors can access live cluster health and uptime at <code>http://localhost:3002/status</code>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
                  className={`w-14 h-8 rounded-full transition-all relative p-1 cursor-pointer border shrink-0 ${
                    config.enabled
                      ? "bg-lime-400 border-lime-500"
                      : "bg-black/50 border-zinc-700"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-black transition-all ${
                      config.enabled ? "translate-x-6 bg-black" : "translate-x-0 bg-zinc-400"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 2. COMPONENT VISIBILITY SELECTOR */}
            <div
              className="w-full rounded-2xl border p-5 md:p-6 space-y-4"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center gap-2.5 border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <Layers className="w-4 h-4 text-lime-400" />
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                    Core System Portals
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Select which core web portals are tracked on the status page.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Portal Toggle */}
                <div
                  onClick={() => setConfig(c => ({ ...c, includeUser: !c.includeUser }))}
                  className="p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
                  style={config.includeUser
                    ? { backgroundColor: "rgba(163, 230, 53, 0.08)", borderColor: "var(--color-rp-accent)" }
                    : { backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", opacity: 0.6 }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate" style={{ color: "var(--color-rp-text)" }}>
                        User Client Portal
                      </h4>
                      <p className="text-[11px] truncate" style={{ color: "var(--color-rp-text-muted)" }}>
                        Port 3002 · Client Dashboard &amp; Console
                      </p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-lg border shrink-0 flex items-center justify-center ${config.includeUser ? "bg-lime-400 border-lime-400 text-black" : "border-zinc-600"}`}>
                    {config.includeUser && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Admin Portal Toggle */}
                <div
                  onClick={() => setConfig(c => ({ ...c, includeAdmin: !c.includeAdmin }))}
                  className="p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between"
                  style={config.includeAdmin
                    ? { backgroundColor: "rgba(163, 230, 53, 0.08)", borderColor: "var(--color-rp-accent)" }
                    : { backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", opacity: 0.6 }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate" style={{ color: "var(--color-rp-text)" }}>
                        Admin Management Plane
                      </h4>
                      <p className="text-[11px] truncate" style={{ color: "var(--color-rp-text-muted)" }}>
                        Port 3000 · Fleet Orchestrator
                      </p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-lg border shrink-0 flex items-center justify-center ${config.includeAdmin ? "bg-lime-400 border-lime-400 text-black" : "border-zinc-600"}`}>
                    {config.includeAdmin && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. NODE CLUSTERS SELECTION MATRIX (FULL RESPONSIVE GRID) */}
            <div
              className="w-full rounded-2xl border p-5 md:p-6 space-y-4"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <div className="flex items-center gap-2.5">
                  <MonitorSpeaker className="w-4 h-4 text-lime-400" />
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                      Node Compute Clusters ({nodes.length} Registered)
                    </h3>
                    <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      Choose which node daemons appear on the status page. Offline nodes (&gt;60s without heartbeat) will reflect accurate state.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllNodes(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5 transition-all cursor-pointer"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    Include All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllNodes(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5 transition-all cursor-pointer"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {nodes.length > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={nodeSearch}
                    onChange={e => setNodeSearch(e.target.value)}
                    placeholder="Search node name or FQDN..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>
              )}

              {filteredNodes.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                  No matching nodes found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredNodes.map(n => {
                    const included = isNodeIncluded(n.id);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNodeToggle(n.id)}
                        className="p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3"
                        style={included
                          ? { backgroundColor: "rgba(163, 230, 53, 0.08)", borderColor: "var(--color-rp-accent)" }
                          : { backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", opacity: 0.55 }}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${n.isOnline ? "bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" : "bg-zinc-600"}`} />
                            <h4 className="text-xs font-bold truncate" style={{ color: "var(--color-rp-text)" }}>
                              {n.name}
                            </h4>
                          </div>
                          <p className="text-[11px] font-mono truncate" style={{ color: "var(--color-rp-text-muted)" }}>
                            {n.fqdn}
                          </p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-zinc-400">{n.serversCount} active server(s)</span>
                            <span>·</span>
                            {n.isOnline ? (
                              <span className="text-lime-400 font-bold">ONLINE (&lt;1m)</span>
                            ) : (
                              <span className="text-zinc-500 font-semibold">OFFLINE</span>
                            )}
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-lg border shrink-0 flex items-center justify-center ${included ? "bg-lime-400 border-lime-400 text-black" : "border-zinc-600"}`}>
                          {included && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. NOTICE & INCIDENT BANNER */}
            <div
              className="w-full rounded-2xl border p-5 md:p-6 space-y-4"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-lime-400" />
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                      Incident &amp; Maintenance Notice Banner
                    </h3>
                    <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      Broadcast real-time operational advisories at the top of the status page.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, showNotice: !c.showNotice }))}
                  className={`w-12 h-7 rounded-full transition-all relative p-1 cursor-pointer border shrink-0 ${
                    config.showNotice ? "bg-lime-400 border-lime-500" : "bg-black/50 border-zinc-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-black transition-all ${
                      config.showNotice ? "translate-x-5 bg-black" : "translate-x-0 bg-zinc-400"
                    }`}
                  />
                </button>
              </div>

              {config.showNotice && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                      Notice Severity
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: "info", label: "Informational Update" },
                        { id: "warning", label: "Degraded Advisory" },
                        { id: "maintenance", label: "Maintenance Mode" },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setConfig(c => ({ ...c, noticeType: t.id as any }))}
                          className="px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                          style={config.noticeType === t.id
                            ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                            : { backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                      Notice Message
                    </label>
                    <textarea
                      rows={3}
                      value={config.customMessage}
                      onChange={e => setConfig(c => ({ ...c, customMessage: e.target.value }))}
                      placeholder="e.g. Scheduled hardware maintenance on Node Cds-1 today from 02:00 to 03:00 UTC."
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none resize-none"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 5. BRANDING & COPY */}
            <div
              className="w-full rounded-2xl border p-5 md:p-6 space-y-4"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center gap-2.5 border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <Sparkles className="w-4 h-4 text-lime-400" />
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                    Page Branding &amp; Titles
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Configure the text and links displayed to public visitors.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Page Title
                  </label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={e => setConfig(c => ({ ...c, title: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Company / Organization Name
                  </label>
                  <input
                    type="text"
                    value={config.companyName}
                    onChange={e => setConfig(c => ({ ...c, companyName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Description / Tagline
                </label>
                <input
                  type="text"
                  value={config.description}
                  onChange={e => setConfig(c => ({ ...c, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Support / Discord Link
                </label>
                <input
                  type="text"
                  value={config.supportUrl}
                  onChange={e => setConfig(c => ({ ...c, supportUrl: e.target.value }))}
                  placeholder="https://discord.gg/rubberpanel"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-mono"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN (4 COLS): LIVE PREVIEW & TELEMETRY SUMMARY ─── */}
          <div className="xl:col-span-4 space-y-6 w-full">
            {/* Live Status Card Preview */}
            <div
              className="w-full rounded-2xl border p-5 md:p-6 space-y-4 sticky top-6"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <span className="text-xs font-bold uppercase tracking-wider text-lime-400">
                  Live Viewport Preview
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-black/40 text-zinc-400">
                  /status
                </span>
              </div>

              {/* Status Header Preview */}
              <div className="p-4 rounded-xl border bg-black/40 text-center space-y-2" style={{ borderColor: "var(--color-rp-border)" }}>
                <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-xs" style={{ color: "var(--color-rp-text)" }}>
                  {config.title || "Rubber Panel Status"}
                </h4>
                <p className="text-[10px]" style={{ color: "var(--color-rp-text-muted)" }}>
                  99.98% overall uptime recorded
                </p>
              </div>

              {/* Notice Preview */}
              {config.showNotice && config.customMessage && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-[10px] space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Notice Banner</span>
                  </div>
                  <p className="leading-relaxed">{config.customMessage}</p>
                </div>
              )}

              {/* Components Count Summary */}
              <div className="space-y-2 text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <span>Tracked Portals:</span>
                  <strong className="text-white">
                    {(config.includeUser ? 1 : 0) + (config.includeAdmin ? 1 : 0)}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <span>Tracked Nodes:</span>
                  <strong className="text-white">
                    {config.includedNodeIds === "ALL" ? nodes.length : (Array.isArray(config.includedNodeIds) ? config.includedNodeIds.length : 0)} / {nodes.length}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02]">
                  <span>Live Online Nodes:</span>
                  <strong className="text-lime-400">{onlineNodesCount}</strong>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all shadow-md hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Configuration</span>
                </button>

                <a
                  href={userPortalStatusUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all hover:bg-white/5"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  <Eye className="w-3.5 h-3.5 text-lime-400" />
                  <span>Open Public Status in New Tab</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
