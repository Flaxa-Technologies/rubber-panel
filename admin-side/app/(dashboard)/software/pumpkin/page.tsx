"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame, RefreshCw, Check, ArrowRight, ShieldCheck, Download,
  Layers, Server, Globe, Cpu, Hash, Clock, AlertCircle, ExternalLink,
  ChevronRight, Sparkles, CheckCircle2, XCircle
} from "lucide-react";

interface PumpkinBuild {
  id: string;
  versionId: string;
  commitSha: string;
  tag: string;
  versionSequence: string;
  javaVersion: string;
  bedrockVersion: string;
  generatedAt: string;
  publishedAt: string;
  isNightly: boolean;
  isLatest: boolean;
  isOutdated: boolean;
  x64Url?: string;
  x64Sha256?: string;
  x64Size?: number;
  arm64Url?: string;
  arm64Sha256?: string;
  syncedNodes: string; // JSON array of node IDs
}

interface NodeItem {
  id: string;
  name: string;
  status: string;
  fqdn: string;
}

interface RunningServer {
  id: string;
  name: string;
  status: string;
  nodeId: string;
  softwareVersionId?: string;
  softwareVersion?: { version: string; buildNumber?: string };
  node?: { id: string; name: string };
}

export default function PumpkinManagementPage() {
  const [builds, setBuilds] = useState<PumpkinBuild[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [runningServers, setRunningServers] = useState<RunningServer[]>([]);
  const [latestBuild, setLatestBuild] = useState<PumpkinBuild | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingGithub, setCheckingGithub] = useState(false);
  const [syncingNodeMap, setSyncingNodeMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData(autoCheck = false) {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/software/pumpkin${autoCheck ? "?check=true" : ""}`);
      if (res.ok) {
        const d = await res.json();
        setBuilds(d.builds || []);
        setNodes(d.nodes || []);
        setRunningServers(d.runningServers || []);
        setLatestBuild(d.latestBuild || null);
      }
    } catch (err: any) {
      console.error("Failed to load Pumpkin catalog:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCheckGithub() {
    try {
      setCheckingGithub(true);
      setStatusMessage(null);
      const res = await fetch("/api/admin/software/pumpkin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushToNodes: false }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `GitHub Sync Complete: Discovered ${data.syncResult?.newBuildsFound || 0} new build(s)! Latest Nightly: ${data.syncResult?.latestNightlyCommit || "Up to date"}`,
        });
        await loadData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "GitHub sync failed." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Sync request failed." });
    } finally {
      setCheckingGithub(false);
    }
  }

  async function handleSyncBuildToNodes(versionId: string) {
    try {
      setSyncingNodeMap(prev => ({ ...prev, [versionId]: true }));
      setStatusMessage(null);
      const res = await fetch("/api/admin/software/pumpkin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, pushToNodes: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Build "${versionId}" successfully distributed across ${data.nodeResults?.syncedNodesCount || 0} online compute node(s)!`,
        });
        await loadData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to push to nodes." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Node dispatch failed." });
    } finally {
      setSyncingNodeMap(prev => ({ ...prev, [versionId]: false }));
    }
  }

  const onlineNodes = nodes.filter(n => n.status === "ONLINE");

  return (
    <div className="space-y-6 w-full max-w-full pb-12">
      {/* ─── BREADCRUMB ─── */}
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
        <Link href="/software" className="hover:text-white transition-colors">
          Software &amp; Runtimes
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-orange-400 font-bold flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" /> Pumpkin Minecraft Server (Rust)
        </span>
      </div>

      {/* ─── HERO HEADER ─── */}
      <div
        className="rounded-3xl border p-6 md:p-8 relative overflow-hidden shadow-2xl transition-all"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-gradient-to-bl from-orange-500/15 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-inner">
                <Flame className="w-5 h-5" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
                Pumpkin Minecraft Engine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                RUST CORE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                JAVA + BEDROCK
              </span>
            </div>
            <p className="text-xs md:text-sm leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
              High-performance Minecraft server implementation written entirely in Rust. Supports dual Java Edition and Bedrock Edition NetherNet protocols with dynamic port routing, rolling mutable nightly build tracking, and SHA-256 verified node distribution.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={handleCheckGithub}
              disabled={checkingGithub}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-rp-accent)",
                color: "#000",
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingGithub ? "animate-spin" : ""}`} />
              <span>{checkingGithub ? "Checking GitHub..." : "Check for New Builds"}</span>
            </button>

            {latestBuild && (
              <button
                onClick={() => handleSyncBuildToNodes(latestBuild.versionId)}
                disabled={syncingNodeMap[latestBuild.versionId]}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border shadow-sm active:scale-95 disabled:opacity-50 bg-black/40 text-white hover:border-orange-500/50"
              >
                <Download className={`w-3.5 h-3.5 text-orange-400 ${syncingNodeMap[latestBuild.versionId] ? "animate-bounce" : ""}`} />
                <span>Sync Latest to All Nodes</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className={`mt-5 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-300 border-rose-500/30"
          }`}>
            {statusMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* ─── 4 SUMMARY STATS METRICS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Latest Nightly Build */}
        <div
          className="rounded-2xl border p-4 space-y-1 relative overflow-hidden"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Active Nightly</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-lg font-mono font-extrabold text-white flex items-center gap-2 pt-1">
            <span>{latestBuild?.commitSha ? `commit: ${latestBuild.commitSha}` : "Checking..."}</span>
            {latestBuild?.isLatest && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans">
                LATEST
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-0.5">
            <Clock className="w-3 h-3" />
            <span>
              {latestBuild?.generatedAt ? new Date(latestBuild.generatedAt).toLocaleString() : "Unknown"}
            </span>
          </div>
        </div>

        {/* 2. Minecraft Compatibility */}
        <div
          className="rounded-2xl border p-4 space-y-1 relative overflow-hidden"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>MC Protocols</span>
            <Globe className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-sm font-bold text-white pt-1 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">
              Java {latestBuild?.javaVersion || "1.21.4"}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs">
              Bedrock {latestBuild?.bedrockVersion || "1.21.50"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 pt-0.5">Dual-protocol cross-play enabled</p>
        </div>

        {/* 3. Online Node Coverage */}
        <div
          className="rounded-2xl border p-4 space-y-1 relative overflow-hidden"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Fleet Coverage</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-extrabold text-white pt-1">
            {latestBuild ? JSON.parse(latestBuild.syncedNodes || "[]").length : 0} / {onlineNodes.length} Nodes
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{
                width: `${onlineNodes.length > 0 && latestBuild ? (JSON.parse(latestBuild.syncedNodes || "[]").length / onlineNodes.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* 4. Active Running Servers */}
        <div
          className="rounded-2xl border p-4 space-y-1 relative overflow-hidden"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Running Servers</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-extrabold text-white pt-1">
            {runningServers.length} Active
          </div>
          <p className="text-[11px] text-zinc-400 pt-0.5">
            {runningServers.filter(s => s.status === "RUNNING").length} Online right now
          </p>
        </div>
      </div>

      {/* ─── PUMPKIN BUILD CATALOG TABLE ─── */}
      <div
        className="rounded-3xl border overflow-hidden shadow-xl transition-all"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        <div className="p-5 border-b flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--color-rp-text)" }}>
              Discovered Pumpkin Builds &amp; Binaries ({builds.length})
            </h2>
          </div>
          <span className="text-xs text-zinc-400">
            Rolling nightly builds track immutable commit hashes
          </span>
        </div>

        {builds.length === 0 && !loading ? (
          <div className="p-12 text-center space-y-3">
            <Flame className="w-10 h-10 text-orange-400/50 mx-auto" />
            <p className="text-sm font-medium text-zinc-400">No Pumpkin builds discovered yet.</p>
            <button
              onClick={handleCheckGithub}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 text-black shadow-md hover:bg-orange-400 transition-colors"
            >
              Fetch Releases from GitHub
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-white/[0.01]" style={{ borderColor: "var(--color-rp-border)" }}>
                  <th className="py-3 px-5">Build Identifier</th>
                  <th className="py-3 px-4">Release Type</th>
                  <th className="py-3 px-4">Generated Timestamp</th>
                  <th className="py-3 px-4">MC Protocols</th>
                  <th className="py-3 px-4">SHA-256 Checksum</th>
                  <th className="py-3 px-4">Node Distribution</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: "var(--color-rp-border)" }}>
                {builds.map((build) => {
                  const syncedNodesList: string[] = (() => {
                    try { return JSON.parse(build.syncedNodes || "[]"); } catch { return []; }
                  })();
                  const isSyncing = syncingNodeMap[build.versionId];

                  return (
                    <tr key={build.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* 1. Build Identifier */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">{build.commitSha}</span>
                          {build.isLatest && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              LATEST
                            </span>
                          )}
                          {build.isOutdated && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                              PREVIOUS
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 block pt-0.5">{build.versionId}</span>
                      </td>

                      {/* 2. Release Type */}
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          build.isNightly
                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/25"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                        }`}>
                          {build.isNightly ? "NIGHTLY" : "STABLE"}
                        </span>
                      </td>

                      {/* 3. Timestamp */}
                      <td className="py-3.5 px-4 text-zinc-300">
                        {build.generatedAt ? new Date(build.generatedAt).toLocaleString() : "—"}
                      </td>

                      {/* 4. Protocols */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-medium text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded border border-sky-400/20">
                            Java {build.javaVersion}
                          </span>
                          <span className="text-[10px] font-medium text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">
                            Bedrock {build.bedrockVersion}
                          </span>
                        </div>
                      </td>

                      {/* 5. Checksum */}
                      <td className="py-3.5 px-4">
                        {build.x64Sha256 ? (
                          <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1" title={build.x64Sha256}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {build.x64Sha256.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">Unverified</span>
                        )}
                      </td>

                      {/* 6. Node Distribution */}
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          syncedNodesList.length === onlineNodes.length && onlineNodes.length > 0
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : syncedNodesList.length > 0
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                        }`}>
                          {syncedNodesList.length} / {onlineNodes.length} Nodes
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSyncBuildToNodes(build.versionId)}
                            disabled={isSyncing}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-white/10 bg-white/5 hover:border-orange-500/40 hover:text-orange-400 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            <Download className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                            <span>{isSyncing ? "Syncing..." : "Sync Nodes"}</span>
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

      {/* ─── RUNNING PUMPKIN SERVERS INVENTORY ─── */}
      <div
        className="rounded-3xl border p-5 md:p-6 space-y-4 shadow-xl transition-all"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--color-rp-text)" }}>
              Servers Deployed with Pumpkin ({runningServers.length})
            </h3>
          </div>
          <Link
            href="/servers"
            className="text-xs font-bold text-orange-400 hover:underline flex items-center gap-1"
          >
            <span>Create New Pumpkin Server</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {runningServers.length === 0 ? (
          <p className="text-xs text-zinc-400 py-2">No servers are currently running Pumpkin software.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {runningServers.map(s => {
              const installedVer = s.softwareVersion?.version || "nightly";
              const isOutdated = latestBuild && installedVer !== latestBuild.versionId;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border p-4 flex flex-col justify-between space-y-3 bg-black/30"
                  style={{ borderColor: "var(--color-rp-border)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{s.name}</h4>
                      <p className="text-[11px] text-zinc-400">Node: {s.node?.name || s.nodeId}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      s.status === "RUNNING"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-zinc-500/20 text-zinc-400"
                    }`}>
                      {s.status}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-300 text-[11px]">{installedVer}</span>
                    {isOutdated ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Update Available
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Up to Date
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
