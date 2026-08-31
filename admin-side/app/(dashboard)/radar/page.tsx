"use client";

import { useState, useEffect } from "react";
import {
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Check,
  Server,
  MonitorSpeaker,
  Info,
  Layers,
  ArrowUpRight,
  TrendingUp,
  XCircle,
  Loader2,
  Flame,
} from "lucide-react";

interface FleetStats {
  totalNodes: number;
  onlineNodes: number;
  elevatedNodesCount: number;
  shieldMode: boolean;
  connsPerSec: number;
  bytesPerSecIn: number;
  bytesPerSecOut: number;
  activeBansCount: number;
  trustedIpsCount: number;
}

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
  status: string;
  rx: number;
  tx: number;
}

interface TimelineSample {
  timestamp: string;
  connsPerSec: number;
  bytesIn: number;
  bytesOut: number;
  activeBans: number;
}

interface BanRecord {
  id: string;
  nodeId: string;
  serverId?: string | null;
  ip: string;
  port?: number | null;
  reason: string;
  country: string;
  createdAt: string;
  expiresAt: string;
  releasedAt?: string | null;
  manual: boolean;
}

interface TrustedIpItem {
  id: string;
  ip: string;
  label?: string | null;
  createdAt: string;
}

export default function RadarAdminPage() {
  const [activeTab, setActiveTab] = useState<"offenders" | "nodes" | "trusted" | "thresholds">("offenders");
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineSample[]>([]);
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [trustedIps, setTrustedIps] = useState<TrustedIpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Modals
  const [showBanModal, setShowBanModal] = useState(false);
  const [banIpInput, setBanIpInput] = useState("");
  const [banReasonInput, setBanReasonInput] = useState("");
  const [banDurationMinutes, setBanDurationMinutes] = useState("60");
  const [submittingBan, setSubmittingBan] = useState(false);
  const [banError, setBanError] = useState("");

  const [showTrustedModal, setShowTrustedModal] = useState(false);
  const [trustedIpInput, setTrustedIpInput] = useState("");
  const [trustedLabelInput, setTrustedLabelInput] = useState("");
  const [submittingTrusted, setSubmittingTrusted] = useState(false);

  // Shield Mode Toggle
  const [togglingShield, setTogglingShield] = useState(false);

  // Thresholds state
  const [maxConnPerIp, setMaxConnPerIp] = useState("20");
  const [windowSeconds, setWindowSeconds] = useState("10");
  const [banDurationMins, setBanDurationMins] = useState("15");
  const [autoMitigate, setAutoMitigate] = useState(true);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdSuccess, setThresholdSuccess] = useState(false);

  async function loadRadarData() {
    try {
      const [radarRes, bansRes, trustedRes, threshRes] = await Promise.all([
        fetch("/api/admin/radar"),
        fetch("/api/admin/radar/bans"),
        fetch("/api/admin/radar/trusted-ips"),
        fetch("/api/admin/radar/thresholds"),
      ]);

      if (radarRes.ok) {
        const r = await radarRes.json();
        setFleetStats(r.fleet || null);
        setNodes(r.nodes || []);
        setTimeline(r.timeline || []);
      }

      if (bansRes.ok) {
        const b = await bansRes.json();
        setBans(b.bans || []);
      }

      if (trustedRes.ok) {
        const t = await trustedRes.json();
        setTrustedIps(t.trustedIps || []);
      }

      if (threshRes.ok) {
        const th = await threshRes.json();
        const global = th.thresholds?.find((x: any) => !x.serverId) || th.thresholds?.[0];
        if (global) {
          setMaxConnPerIp(String(global.maxConnPerIpPerWindow || 20));
          setWindowSeconds(String(Math.round((global.windowMs || 10000) / 1000)));
          setBanDurationMins(String(Math.round((global.banDurationMs || 900000) / 60000)));
          setAutoMitigate(global.autoMitigate !== false);
        }
      }
    } catch (err) {
      console.error("Radar telemetry fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRadarData();
    const interval = setInterval(loadRadarData, 3000);
    return () => clearInterval(interval);
  }, []);

  async function handleCopy(ip: string) {
    await navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1500);
  }

  async function handleToggleShieldMode() {
    if (!fleetStats) return;
    setTogglingShield(true);
    try {
      const res = await fetch("/api/admin/radar/shield-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !fleetStats.shieldMode }),
      });
      if (res.ok) {
        await loadRadarData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingShield(false);
    }
  }

  async function handleCreateBan(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingBan(true);
    setBanError("");

    try {
      const res = await fetch("/api/admin/radar/bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: banIpInput.trim(),
          reason: banReasonInput.trim(),
          durationMinutes: parseInt(banDurationMinutes, 10) || 60,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowBanModal(false);
        setBanIpInput("");
        setBanReasonInput("");
        await loadRadarData();
      } else {
        setBanError(data.error || "Failed to create ban");
      }
    } catch (err: any) {
      setBanError(err?.message || "Network error");
    } finally {
      setSubmittingBan(false);
    }
  }

  async function handleUnban(banId: string) {
    try {
      const res = await fetch(`/api/admin/radar/bans/${banId}`, { method: "DELETE" });
      if (res.ok) {
        await loadRadarData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to unban IP");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddTrustedIp(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingTrusted(true);
    try {
      const res = await fetch("/api/admin/radar/trusted-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: trustedIpInput.trim(),
          label: trustedLabelInput.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowTrustedModal(false);
        setTrustedIpInput("");
        setTrustedLabelInput("");
        await loadRadarData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to add trusted IP");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingTrusted(false);
    }
  }

  async function handleDeleteTrustedIp(id: string) {
    try {
      const res = await fetch(`/api/admin/radar/trusted-ips/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadRadarData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveThresholds(e: React.FormEvent) {
    e.preventDefault();
    setSavingThresholds(true);
    setThresholdSuccess(false);

    try {
      const res = await fetch("/api/admin/radar/thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxConnPerIpPerWindow: parseInt(maxConnPerIp, 10) || 20,
          windowMs: (parseInt(windowSeconds, 10) || 10) * 1000,
          banDurationMs: (parseInt(banDurationMins, 10) || 15) * 60 * 1000,
          autoMitigate,
        }),
      });

      if (res.ok) {
        setThresholdSuccess(true);
        setTimeout(() => setThresholdSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingThresholds(false);
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return "0 B/s";
    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  // Generate SVG points for live timeline chart
  const maxConns = Math.max(10, ...timeline.map((t) => t.connsPerSec));
  const chartHeight = 120;
  const chartWidth = 700;
  const points = timeline.map((sample, idx) => {
    const x = timeline.length <= 1 ? 0 : (idx / (timeline.length - 1)) * chartWidth;
    const y = chartHeight - (sample.connsPerSec / maxConns) * (chartHeight - 15) - 8;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-6">
      {/* Header & Reality Check Note */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio size={22} className="text-lime-400 animate-pulse" />
            <h1 className="text-xl font-bold" style={{ color: "var(--color-rp-text)" }}>
              Traffic Radar &amp; Threat Shield
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono font-bold bg-lime-500/10 text-lime-400 border border-lime-500/20">
              FLEET TELEMETRY
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Real-time connection rate inspection, per-IP abuse mitigation, and fleet-wide iptables firewall synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadRadarData()}
            className="p-2 rounded-lg border hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
            title="Refresh Telemetry"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-lime-400" : ""} />
          </button>

          <button
            onClick={() => {
              setBanError("");
              setShowBanModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border hover:bg-white/10 transition-all"
            style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          >
            <Plus size={14} />
            <span>Manual Ban IP</span>
          </button>

          <button
            onClick={handleToggleShieldMode}
            disabled={togglingShield}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg ${
              fleetStats?.shieldMode
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-lime-400 hover:bg-lime-300 text-black"
            }`}
          >
            {togglingShield ? (
              <Loader2 size={14} className="animate-spin" />
            ) : fleetStats?.shieldMode ? (
              <ShieldAlert size={14} />
            ) : (
              <ShieldCheck size={14} />
            )}
            <span>{fleetStats?.shieldMode ? "SHIELD MODE ACTIVE" : "ACTIVATE SHIELD MODE"}</span>
          </button>
        </div>
      </div>

      {/* Upfront Reality Check Alert Banner */}
      <div
        className="p-3.5 rounded-xl border flex items-start gap-3 text-xs"
        style={{
          backgroundColor: "rgba(56,189,248,0.06)",
          borderColor: "rgba(56,189,248,0.2)",
          color: "#93c5fd",
        }}
      >
        <Info size={16} className="text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Network Infrastructure Notice:</strong> For volumetric multi-Gbps floods (SYN/UDP floods), ensure your hosting provider's network-level DDoS mitigation is active (OVH, Hetzner, Cloudflare Magic Transit). Rubber Radar handles <strong>application-layer abuse</strong>, connection-rate anomalies, slowloris connection holds, and orchestrates fleet-wide instant IP blocks.
        </div>
      </div>

      {/* Fleet Stats Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Fleet Connections / Sec
            </span>
            <Activity size={16} className="text-lime-400" />
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>
            {fleetStats?.connsPerSec || 0}
          </div>
          <div className="text-xs mt-1 text-lime-400 flex items-center gap-1">
            <TrendingUp size={12} />
            <span>Across {fleetStats?.onlineNodes || 0} online nodes</span>
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Live Fleet Bandwidth
            </span>
            <Zap size={16} className="text-sky-400" />
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>
            {formatBytes(fleetStats?.bytesPerSecIn || 0)}
          </div>
          <div className="text-xs mt-1 text-zinc-400">
            Out: {formatBytes(fleetStats?.bytesPerSecOut || 0)}
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Active Fleet Bans
            </span>
            <ShieldAlert size={16} className="text-red-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-red-400 font-mono">
            {bans.filter((b) => !b.releasedAt && new Date(b.expiresAt) > new Date()).length}
          </div>
          <div className="text-xs mt-1 text-zinc-400">
            iptables RUBBER_RADAR active
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Fleet Defense State
            </span>
            <Flame size={16} className={fleetStats?.shieldMode ? "text-amber-400" : "text-emerald-400"} />
          </div>
          <div
            className={`text-sm font-bold mt-2 font-mono ${
              fleetStats?.shieldMode ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {fleetStats?.shieldMode ? "SHIELD MODE ACTIVE" : "STANDARD PROTECTION"}
          </div>
          <div className="text-xs mt-1 text-zinc-400">
            {fleetStats?.trustedIpsCount || 0} trusted whitelist IPs
          </div>
        </div>
      </div>

      {/* Live 15-Minute Fleet Traffic Graph */}
      <div
        className="p-5 rounded-xl border space-y-3"
        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
              Fleet Traffic Curve (Last 15 Minutes)
            </h3>
            <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
              Connection rate fluctuations across all compute node ports
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-lime-400">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400" />
              <span>Conns / Sec</span>
            </div>
            <div className="text-zinc-500 font-mono text-[11px]">
              Peak: {maxConns} req/s
            </div>
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-lg bg-black/40 p-2 border border-white/5">
          {timeline.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs text-zinc-500">
              Aggregating live traffic telemetry...
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-32 overflow-visible">
              <defs>
                <linearGradient id="limeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a3e635" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#a3e635" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              {timeline.length > 1 && (
                <polygon
                  points={`0,${chartHeight} ${points} ${chartWidth},${chartHeight}`}
                  fill="url(#limeGradient)"
                />
              )}

              {/* Stroke line */}
              {timeline.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#a3e635"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
              )}
            </svg>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
        <button
          onClick={() => setActiveTab("offenders")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "offenders" ? "border-lime-400 text-lime-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ShieldAlert size={14} />
          <span>Active Bans &amp; Offenders ({bans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("nodes")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "nodes" ? "border-lime-400 text-lime-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <MonitorSpeaker size={14} />
          <span>Node Fleet Breakdown ({nodes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("trusted")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "trusted" ? "border-lime-400 text-lime-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ShieldCheck size={14} />
          <span>Trusted IPs Whitelist ({trustedIps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("thresholds")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "thresholds" ? "border-lime-400 text-lime-400" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers size={14} />
          <span>Threshold Policies</span>
        </button>
      </div>

      {/* Tab 1: Offenders & Active Bans */}
      {activeTab === "offenders" && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text-dim)",
                  }}
                >
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Offender IP &amp; Origin</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Reason &amp; Trigger</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Target Node / Server</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Ban Expiration</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {bans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldCheck size={32} className="text-emerald-400 opacity-40" />
                        <p className="text-sm font-medium text-zinc-300">No active or historical bans</p>
                        <p className="text-xs text-zinc-500">
                          Radar is continuously monitoring established sockets on all compute nodes.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bans.map((ban) => {
                    const isExpired = new Date(ban.expiresAt) <= new Date() || ban.releasedAt;
                    return (
                      <tr key={ban.id} className="hover:bg-white/[0.02] transition-colors" style={{ color: "var(--color-rp-text)" }}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-red-400">{ban.ip}</span>
                            <button
                              onClick={() => handleCopy(ban.ip)}
                              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                              title="Copy IP"
                            >
                              {copiedIp === ban.ip ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                            <Globe size={11} />
                            <span>Country: {ban.country || "Unknown"}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="font-medium text-zinc-200">{ban.reason}</div>
                          <div className="text-[10.5px] text-zinc-500 mt-0.5">
                            {ban.manual ? "Manual admin ban" : "Automatic rate-limit trigger"}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-300">
                          <div>Node: {ban.nodeId.substring(0, 12)}...</div>
                          {ban.port && <div className="text-zinc-500">Port: {ban.port}</div>}
                        </td>

                        <td className="px-4 py-3.5">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                              RELEASED / EXPIRED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-fit">
                              <Lock size={10} /> BANNED (DROP)
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-zinc-400 text-xs">
                          {isExpired ? (
                            <span>Expired</span>
                          ) : (
                            <span>{new Date(ban.expiresAt).toLocaleTimeString()}</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          {!isExpired && (
                            <button
                              onClick={() => handleUnban(ban.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border hover:bg-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 transition-colors"
                              style={{ borderColor: "var(--color-rp-border)" }}
                            >
                              Unban IP
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Node Fleet Breakdown */}
      {activeTab === "nodes" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="p-5 rounded-xl border space-y-3"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MonitorSpeaker size={16} className="text-lime-400" />
                  <span className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                    {node.name}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    node.status === "ONLINE"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {node.status}
                </span>
              </div>

              <div className="text-xs text-zinc-400 font-mono">
                Host: {node.fqdn}
              </div>

              <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 block text-[10px]">INBOUND</span>
                  <span className="font-bold text-lime-400">{formatBytes(node.rx)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">OUTBOUND</span>
                  <span className="font-bold text-sky-400">{formatBytes(node.tx)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Trusted IPs */}
      {activeTab === "trusted" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
              Trusted IP addresses, administration subnets, and reverse proxies are permanently exempt from rate-limiting and bans.
            </p>
            <button
              onClick={() => setShowTrustedModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 transition-colors"
            >
              <Plus size={13} />
              <span>Add Trusted IP</span>
            </button>
          </div>

          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text-dim)",
                  }}
                >
                  <th className="px-4 py-3 font-semibold uppercase">IP / Subnet</th>
                  <th className="px-4 py-3 font-semibold uppercase">Label / Description</th>
                  <th className="px-4 py-3 font-semibold uppercase">Added Date</th>
                  <th className="px-4 py-3 font-semibold uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {trustedIps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                      No custom trusted IPs registered. (RFC1918 private subnets are exempt by default).
                    </td>
                  </tr>
                ) : (
                  trustedIps.map((tip) => (
                    <tr key={tip.id} className="hover:bg-white/[0.02]" style={{ color: "var(--color-rp-text)" }}>
                      <td className="px-4 py-3 font-mono font-bold text-sky-400">{tip.ip}</td>
                      <td className="px-4 py-3 text-zinc-300">{tip.label || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{new Date(tip.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteTrustedIp(tip.id)}
                          className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Thresholds & Policies */}
      {activeTab === "thresholds" && (
        <form onSubmit={handleSaveThresholds} className="space-y-6 max-w-2xl">
          <div
            className="p-6 rounded-xl border space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                Global Sliding-Window Thresholds
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                Configure connection rate detection rules across all compute nodes.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text)" }}>
                Max Connections Per IP Per Window
              </label>
              <input
                type="number"
                min={2}
                max={200}
                value={maxConnPerIp}
                onChange={(e) => setMaxConnPerIp(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                style={{
                  backgroundColor: "var(--color-rp-surface-2)",
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text)",
                }}
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Default: 20 connections. IPs opening more than this limit in the evaluation window are flagged.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text)" }}>
                Sliding Window Duration (Seconds)
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={windowSeconds}
                onChange={(e) => setWindowSeconds(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                style={{
                  backgroundColor: "var(--color-rp-surface-2)",
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text)",
                }}
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Default: 10 seconds. Time window for rolling connection counter.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text)" }}>
                Automatic Ban Duration (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={banDurationMins}
                onChange={(e) => setBanDurationMins(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                style={{
                  backgroundColor: "var(--color-rp-surface-2)",
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text)",
                }}
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Default: 15 minutes. Automatically removed from iptables upon expiration.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
              <div>
                <label className="text-xs font-semibold block" style={{ color: "var(--color-rp-text)" }}>
                  Automatic Mitigation (iptables DROP)
                </label>
                <p className="text-[11px] text-zinc-500">
                  Automatically drop offending packets when thresholds are breached.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoMitigate}
                onChange={(e) => setAutoMitigate(e.target.checked)}
                className="w-4 h-4 rounded accent-lime-400 cursor-pointer"
              />
            </div>

            {thresholdSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs flex items-center gap-2">
                <Check size={14} />
                <span>Radar threshold policies synchronized across all nodes.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingThresholds}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-lime-400 text-black hover:bg-lime-300 transition-all"
            >
              {savingThresholds ? "Saving Policies..." : "Save Policies"}
            </button>
          </div>
        </form>
      )}

      {/* Manual Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-400" />
                <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                  Manual IP Ban (iptables DROP)
                </h3>
              </div>
              <button onClick={() => setShowBanModal(false)} className="text-zinc-400 hover:text-white">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBan} className="space-y-4">
              {banError && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} />
                  <span>{banError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Target IP Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={banIpInput}
                  onChange={(e) => setBanIpInput(e.target.value)}
                  placeholder="e.g. 198.51.100.42"
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono border outline-none"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Ban Reason <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="e.g. Minecraft bot connection flood"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={525600}
                  value={banDurationMinutes}
                  onChange={(e) => setBanDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono border outline-none"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBan}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all"
                >
                  {submittingBan ? "Applying DROP rule..." : "Ban IP Fleet-Wide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Trusted IP Modal */}
      {showTrustedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-rp-border)" }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-lime-400" />
                <h3 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                  Add Trusted IP (Exempt from Bans)
                </h3>
              </div>
              <button onClick={() => setShowTrustedModal(false)} className="text-zinc-400 hover:text-white">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTrustedIp} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  IP Address or Subnet <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={trustedIpInput}
                  onChange={(e) => setTrustedIpInput(e.target.value)}
                  placeholder="e.g. 203.0.113.10"
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono border outline-none"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Label / Description
                </label>
                <input
                  type="text"
                  value={trustedLabelInput}
                  onChange={(e) => setTrustedLabelInput(e.target.value)}
                  placeholder="e.g. Headquarters Office VPN"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrustedModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTrusted}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-lime-400 hover:bg-lime-300 text-black transition-all"
                >
                  {submittingTrusted ? "Saving..." : "Add to Whitelist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
