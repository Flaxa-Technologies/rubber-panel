"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw, Download, CheckCircle2, XCircle, AlertTriangle,
  ArrowUpCircle, Box, Server, MonitorSpeaker, ExternalLink,
  ChevronDown, ChevronUp, Loader2, Terminal, Clock, GitBranch,
  Shield, Zap, Package, Activity, Cpu, HardDrive
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetInfo {
  side: "admin" | "user" | "node";
  downloadUrl: string;
  sizeBytes: number;
}

interface NodeUpdateItem {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  status: string;
  agentVersion: string | null;
  currentVersion: string;
  lastHeartbeat: string | null;
  needsUpdate: boolean;
}

interface UpdateData {
  available: boolean;
  latestVersion: string;
  releaseUrl?: string;
  changelog?: string;
  publishedAt?: string;
  assets: AssetInfo[];
  currentVersions: { admin: string; user: string; node: string };
  nodes?: NodeUpdateItem[];
}

type UpdateStatus = "idle" | "checking" | "downloading" | "extracting" | "migrating" | "building" | "done" | "error";

interface ProgressState {
  status: UpdateStatus;
  logs: string[];
  percent?: number;
  message?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sizeStr(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(iso?: string | null) {
  if (!iso) return "never";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const SIDE_META = {
  admin: { label: "Admin Panel", icon: Shield, color: "#a3e635", desc: "Management plane, fleet orchestrator & API gateways" },
  user: { label: "User Panel", icon: Box, color: "#60a5fa", desc: "Client dashboard, server console & SFTP endpoints" },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpdatesPage() {
  const [updateData, setUpdateData] = useState<UpdateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  // Per-side and per-node progress states (keyed by 'admin', 'user', or 'node:<id>')
  const [progressStates, setProgressStates] = useState<Record<string, ProgressState>>({
    admin: { status: "idle", logs: [] },
    user: { status: "idle", logs: [] },
  });

  const logRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchUpdates = useCallback(async (force = false) => {
    try {
      setChecking(true);
      setError(null);
      const url = force ? "/api/admin/updates?force=true" : "/api/admin/updates";
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data: UpdateData = await res.json();
      setUpdateData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  // Auto-scroll logs
  useEffect(() => {
    for (const el of Object.values(logRefs.current)) {
      if (el) el.scrollTop = el.scrollHeight;
    }
  });

  function isVersionNewer(current: string, latest: string): boolean {
    if (!current || !latest) return false;
    const clean = (v: string) => v.replace(/^v/, "").trim();
    const c = clean(current);
    const l = clean(latest);
    return c !== l;
  }

  async function handleApplyUpdate(side: "admin" | "user" | "node", nodeId?: string) {
    if (!updateData) return;
    const asset = updateData.assets.find((a) => a.side === side);
    if (!asset) {
      setError(`No release asset found for ${side}-side in release ${updateData.latestVersion}`);
      return;
    }

    const stateKey = nodeId ? `node:${nodeId}` : side;

    setProgressStates((prev) => ({
      ...prev,
      [stateKey]: {
        status: "downloading",
        logs: [`Initiating ${nodeId ? `Node (${nodeId})` : side} update to ${updateData.latestVersion}...`],
      },
    }));

    try {
      const res = await fetch("/api/admin/updates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          nodeId,
          assetUrl: asset.downloadUrl,
          version: updateData.latestVersion,
        }),
      });

      if (!res.body) throw new Error("No response stream from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let event = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { event = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              const phase = event === "progress" ? data.phase : event;
              const msg = data.message ?? "";
              setProgressStates((prev) => ({
                ...prev,
                [stateKey]: {
                  status: (phase || "downloading") as UpdateStatus,
                  logs: [...(prev[stateKey]?.logs || []), msg],
                  percent: data.percent,
                  message: msg,
                },
              }));
            } catch {}
          }
        }
      }

      // Re-fetch status to refresh node list
      setTimeout(() => fetchUpdates(true), 3000);
    } catch (e: any) {
      setProgressStates((prev) => ({
        ...prev,
        [stateKey]: {
          status: "error",
          logs: [...(prev[stateKey]?.logs || []), `Error: ${e.message}`],
          message: e.message,
        },
      }));
    }
  }

  const isUpdating = (s?: UpdateStatus) => s && !["idle", "done", "error"].includes(s);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-screen p-6 space-y-6" style={{ color: "var(--color-rp-text)" }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="p-2.5 rounded-xl"
              style={{ background: "rgba(163,230,53,0.12)", border: "1px solid rgba(163,230,53,0.25)" }}
            >
              <ArrowUpCircle className="w-5 h-5" style={{ color: "#a3e635" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>
              Update Manager
            </h1>
          </div>
          <p className="text-sm ml-14" style={{ color: "var(--color-rp-text-muted)" }}>
            Manage & deploy updates for Admin Panel, User Panel, and all connected Node Daemons
          </p>
        </div>

        <div className="flex items-center gap-3">
          {updateData?.releaseUrl && (
            <a
              href={updateData.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors"
              style={{
                backgroundColor: "var(--color-rp-surface-2)",
                borderColor: "var(--color-rp-border)",
                color: "var(--color-rp-text-muted)",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              View Release
            </a>
          )}
          <button
            onClick={() => fetchUpdates(true)}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: "rgba(163,230,53,0.12)",
              border: "1px solid rgba(163,230,53,0.3)",
              color: "#a3e635",
            }}
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Check for Updates"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
        >
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#a3e635" }} />
          <span className="ml-3 text-sm" style={{ color: "var(--color-rp-text-muted)" }}>
            Polling GitHub Releases...
          </span>
        </div>
      )}

      {!loading && updateData && (
        <>
          {/* Overall Status Banner */}
          {updateData.available ? (
            <div
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(163,230,53,0.08) 0%, rgba(163,230,53,0.04) 100%)",
                border: "1px solid rgba(163,230,53,0.3)",
              }}
            >
              <div className="p-2 rounded-lg" style={{ background: "rgba(163,230,53,0.15)" }}>
                <Zap className="w-5 h-5" style={{ color: "#a3e635" }} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: "#a3e635" }}>
                  New Release Available — {updateData.latestVersion}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                  {updateData.publishedAt ? `Released ${timeAgo(updateData.publishedAt)}` : ""}
                  {" · "}
                  {updateData.assets.length} package asset{updateData.assets.length !== 1 ? "s" : ""} ready
                </div>
              </div>
              <button
                onClick={() => setShowChangelog(!showChangelog)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  backgroundColor: "rgba(163,230,53,0.1)",
                  border: "1px solid rgba(163,230,53,0.2)",
                  color: "#a3e635",
                }}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Changelog
                {showChangelog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
            >
              <div className="p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.12)" }}>
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="font-semibold text-sm text-green-400">System Up To Date</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                  Running latest release ({updateData.latestVersion}).
                </div>
              </div>
            </div>
          )}

          {/* Changelog Drawer */}
          {showChangelog && updateData.changelog && (
            <div
              className="p-5 rounded-xl text-sm leading-relaxed"
              style={{
                backgroundColor: "var(--color-rp-surface-2)",
                border: "1px solid var(--color-rp-border)",
                color: "var(--color-rp-text-muted)",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {updateData.changelog}
            </div>
          )}

          {/* Core Panel Sides: Admin & User */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(["admin", "user"] as const).map((side) => {
              const meta = SIDE_META[side];
              const Icon = meta.icon;
              const state = progressStates[side] || { status: "idle", logs: [] };
              const asset = updateData.assets.find((a) => a.side === side);
              const cv = updateData.currentVersions[side];
              const lv = updateData.latestVersion;
              const needsUpdate = isVersionNewer(cv, lv) && !!asset;
              const busy = isUpdating(state.status);

              return (
                <div
                  key={side}
                  className="flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: "var(--color-rp-surface)",
                    border: `1px solid ${needsUpdate ? `${meta.color}30` : "var(--color-rp-border)"}`,
                  }}
                >
                  <div className="p-5 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="p-2.5 rounded-xl"
                        style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      {needsUpdate && (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}
                        >
                          Update Available
                        </span>
                      )}
                      {state.status === "done" && (
                        <span
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(163,230,53,0.12)", color: "#a3e635", border: "1px solid rgba(163,230,53,0.3)" }}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Updated
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-rp-text)" }}>
                      {meta.label}
                    </div>
                    <div className="text-xs mb-3" style={{ color: "var(--color-rp-text-muted)" }}>
                      {meta.desc}
                    </div>

                    {/* Version Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className="p-2.5 rounded-lg text-center"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", border: "1px solid var(--color-rp-border)" }}
                      >
                        <div className="text-xs mb-1" style={{ color: "var(--color-rp-text-dim)" }}>Current</div>
                        <div className="font-mono font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                          {cv}
                        </div>
                      </div>
                      <div
                        className="p-2.5 rounded-lg text-center"
                        style={{
                          backgroundColor: needsUpdate ? `${meta.color}08` : "var(--color-rp-surface-2)",
                          border: `1px solid ${needsUpdate ? `${meta.color}25` : "var(--color-rp-border)"}`,
                        }}
                      >
                        <div className="text-xs mb-1" style={{ color: "var(--color-rp-text-dim)" }}>Latest</div>
                        <div className="font-mono font-bold text-sm" style={{ color: needsUpdate ? meta.color : "var(--color-rp-text)" }}>
                          {lv}
                        </div>
                      </div>
                    </div>

                    {asset && (
                      <div
                        className="flex items-center justify-between mt-3 px-3 py-2 rounded-lg text-xs"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}
                      >
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3 h-3" />
                          {sizeStr(asset.sizeBytes)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Auto-restart enabled
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Terminal Log */}
                  {state.logs.length > 0 && (
                    <div
                      ref={(el) => { logRefs.current[side] = el; }}
                      className="flex-1 p-4 font-mono text-xs leading-5 overflow-y-auto"
                      style={{
                        backgroundColor: "#0a0a0a",
                        color: "#d4d4d4",
                        maxHeight: "160px",
                        minHeight: "100px",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <Terminal className="w-3 h-3" style={{ color: meta.color }} />
                        <span style={{ color: "#6b7280" }}>Update Terminal — {meta.label}</span>
                      </div>
                      {state.logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span style={{ color: "#374151", userSelect: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                          <span style={{ color: log.toLowerCase().includes("error") ? "#f87171" : log.toLowerCase().includes("success") || log.toLowerCase().includes("complete") ? "#a3e635" : "#d4d4d4" }}>
                            {log}
                          </span>
                        </div>
                      ))}
                      {busy && (
                        <div className="flex items-center gap-2 mt-1">
                          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#f59e0b" }} />
                          <span style={{ color: "#f59e0b" }}>
                            {state.status.charAt(0).toUpperCase() + state.status.slice(1)}...
                            {state.percent !== undefined ? ` ${state.percent}%` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="p-4 mt-auto">
                    {needsUpdate && !busy && state.status !== "done" ? (
                      <button
                        onClick={() => handleApplyUpdate(side)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}15)`,
                          border: `1px solid ${meta.color}40`,
                          color: meta.color,
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Update {meta.label} to {lv}
                      </button>
                    ) : !needsUpdate && state.status === "idle" ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
                          style={{
                            backgroundColor: "rgba(34,197,94,0.06)",
                            border: "1px solid rgba(34,197,94,0.15)",
                            color: "#4ade80",
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Up to date
                        </div>
                        {asset && (
                          <button
                            onClick={() => handleApplyUpdate(side)}
                            title="Force re-install current release files"
                            className="px-3 py-2.5 rounded-xl text-xs transition-colors border"
                            style={{
                              backgroundColor: "var(--color-rp-surface-2)",
                              borderColor: "var(--color-rp-border)",
                              color: "var(--color-rp-text-muted)",
                            }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : busy ? (
                      <div
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
                        style={{
                          backgroundColor: "rgba(245,158,11,0.08)",
                          border: "1px solid rgba(245,158,11,0.2)",
                          color: "#f59e0b",
                        }}
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {state.status.charAt(0).toUpperCase() + state.status.slice(1)}...
                      </div>
                    ) : state.status === "done" ? (
                      <div
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
                        style={{
                          background: "rgba(163,230,53,0.08)",
                          border: "1px solid rgba(163,230,53,0.2)",
                          color: "#a3e635",
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Updated — Auto-Restarting
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApplyUpdate(side)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm"
                        style={{
                          backgroundColor: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                        }}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry Update
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Node Daemons Fleet Section */}
          <div
            className="rounded-2xl overflow-hidden border"
            style={{
              backgroundColor: "var(--color-rp-surface)",
              borderColor: "var(--color-rp-border)",
            }}
          >
            <div
              className="p-5 border-b flex items-center justify-between flex-wrap gap-4"
              style={{ borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  <MonitorSpeaker className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: "var(--color-rp-text)" }}>
                    Node Daemons Fleet
                  </h2>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Manage daemon agent versions and trigger remote zero-downtime updates across all compute nodes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-xs px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}
                >
                  Latest Node Release: <strong style={{ color: "#f59e0b" }}>{updateData.latestVersion}</strong>
                </span>
              </div>
            </div>

            {/* Nodes Table */}
            {(!updateData.nodes || updateData.nodes.length === 0) ? (
              <div className="p-10 text-center text-sm" style={{ color: "var(--color-rp-text-muted)" }}>
                No compute nodes registered yet. Add nodes under the <strong>Nodes</strong> section.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {updateData.nodes.map((node) => {
                  const stateKey = `node:${node.id}`;
                  const state = progressStates[stateKey] || { status: "idle", logs: [] };
                  const busy = isUpdating(state.status);
                  const isOnline = node.status === "ONLINE";
                  const nodeNeedsUpdate = isVersionNewer(node.currentVersion, updateData.latestVersion);

                  return (
                    <div key={node.id} className="p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-400 shadow-sm shadow-green-400/50" : "bg-red-400"}`}
                          />
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
                              {node.name}
                              <span className="font-mono text-xs font-normal" style={{ color: "var(--color-rp-text-dim)" }}>
                                ({node.fqdn}:{node.port})
                              </span>
                            </div>
                            <div className="text-xs flex items-center gap-3 mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                              <span>Status: <strong className={isOnline ? "text-green-400" : "text-red-400"}>{node.status}</strong></span>
                              <span>·</span>
                              <span>Last ping: {timeAgo(node.lastHeartbeat)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Version info & action */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>Installed Version</div>
                            <div className="font-mono text-sm font-bold" style={{ color: nodeNeedsUpdate ? "#f59e0b" : "var(--color-rp-text)" }}>
                              {node.currentVersion}
                            </div>
                          </div>

                          <div>
                            {nodeNeedsUpdate && !busy && state.status !== "done" ? (
                              <button
                                onClick={() => handleApplyUpdate("node", node.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                style={{
                                  background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.12))",
                                  border: "1px solid rgba(245,158,11,0.4)",
                                  color: "#f59e0b",
                                }}
                              >
                                <Download className="w-3.5 h-3.5" />
                                Update to {updateData.latestVersion}
                              </button>
                            ) : !nodeNeedsUpdate && state.status === "idle" ? (
                              <div
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                                style={{
                                  backgroundColor: "rgba(34,197,94,0.06)",
                                  border: "1px solid rgba(34,197,94,0.15)",
                                  color: "#4ade80",
                                }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Up to date
                              </div>
                            ) : busy ? (
                              <div
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                                style={{
                                  backgroundColor: "rgba(245,158,11,0.08)",
                                  border: "1px solid rgba(245,158,11,0.2)",
                                  color: "#f59e0b",
                                }}
                              >
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Updating...
                              </div>
                            ) : state.status === "done" ? (
                              <div
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                                style={{
                                  background: "rgba(163,230,53,0.08)",
                                  border: "1px solid rgba(163,230,53,0.2)",
                                  color: "#a3e635",
                                }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Updated & Restarted
                              </div>
                            ) : (
                              <button
                                onClick={() => handleApplyUpdate("node", node.id)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                                style={{
                                  backgroundColor: "rgba(239,68,68,0.08)",
                                  border: "1px solid rgba(239,68,68,0.2)",
                                  color: "#f87171",
                                }}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Retry
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Per-Node Update Progress Log */}
                      {state.logs.length > 0 && (
                        <div
                          ref={(el) => { logRefs.current[stateKey] = el; }}
                          className="p-3 rounded-xl font-mono text-xs leading-5 overflow-y-auto"
                          style={{
                            backgroundColor: "#0a0a0a",
                            color: "#d4d4d4",
                            maxHeight: "120px",
                          }}
                        >
                          {state.logs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                              <span style={{ color: "#374151", userSelect: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                              <span style={{ color: log.toLowerCase().includes("error") ? "#f87171" : log.toLowerCase().includes("success") || log.toLowerCase().includes("done") ? "#a3e635" : "#d4d4d4" }}>
                                {log}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info & Safety Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}
            >
              <div className="text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-dim)" }}>Repository</div>
              <div className="font-mono text-sm" style={{ color: "var(--color-rp-text)" }}>
                Flaxa-Technologies/rubber-panel
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}
            >
              <div className="text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-dim)" }}>Auto-Restart Protocol</div>
              <div className="text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                <span style={{ color: "var(--color-rp-text-muted)" }}>PM2 / Systemd Auto-Respawn</span>
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}
            >
              <div className="text-xs font-medium mb-1" style={{ color: "var(--color-rp-text-dim)" }}>Data Preservation</div>
              <div className="text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span style={{ color: "var(--color-rp-text-muted)" }}>Zero data loss guarantee</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
