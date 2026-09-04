"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useServer } from "@/components/server/ServerContext";
import {
  ArrowLeftRight, Download, Upload, Server, Shield, AlertTriangle,
  AlertCircle, CheckCircle2, Loader2, RefreshCw, HardDrive, Terminal,
  Lock, Key, Folder, File, Eye, EyeOff, Trash2, ShieldCheck, Zap,
  Layers, Play, Square, Check, X, Info
} from "lucide-react";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface AvailableNode {
  id: string;
  name: string;
  location?: string | null;
  status: string;
}

interface ActiveNodeTransfer {
  id: string;
  status: string;
  progress: number;
  currentStep?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceNode?: { name: string; location?: string | null };
  targetNode?: { name: string; location?: string | null };
}

interface SftpJob {
  id: string;
  serverId: string;
  type: "pull" | "transfer";
  status: "running" | "completed" | "failed";
  progressPercent: number;
  currentFile: string;
  transferredFiles: number;
  totalFiles: number;
  transferredBytes: number;
  totalBytes: number;
  logs: string[];
  error?: string;
  startedAt: number;
  completedAt?: number;
}

interface PullManifest {
  remoteFilesCount: number;
  remoteTotalBytes: number;
  sampleRemoteFiles: string[];
  localFilesCount: number;
  localTotalBytes: number;
  overwrittenFiles: string[];
  preservedFiles: string[];
  deletedFiles: string[];
  excludedFiles: string[];
}

export default function ServerTransferPage() {
  const { id } = useParams<{ id: string }>();
  const { server, refreshServer } = useServer();

  const allowRemote = server?.allowRemoteTransfer !== false;
  const allowCluster = Boolean(server?.allowNodeTransfer);

  // Active Top Tab
  const [activeTab, setActiveTab] = useState<"pull" | "transfer" | "cluster">(
    allowRemote ? "pull" : allowCluster ? "cluster" : "pull"
  );

  // General Alert states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. REMOTE SFTP PULL STATE (IMPORT)
  // ─────────────────────────────────────────────────────────────────────────────
  const [pullHost, setPullHost] = useState("");
  const [pullPort, setPullPort] = useState("22");
  const [pullUsername, setPullUsername] = useState("");
  const [pullPassword, setPullPassword] = useState("");
  const [pullPrivateKey, setPullPrivateKey] = useState("");
  const [pullRemotePath, setPullRemotePath] = useState("/");
  const [showPullPassword, setShowPullPassword] = useState(false);
  const [showPullKeyArea, setShowPullKeyArea] = useState(false);

  // Pull Preservations & Exclusions
  const [preserveWorld, setPreserveWorld] = useState(true);
  const [preservePlugins, setPreservePlugins] = useState(true);
  const [preserveConfig, setPreserveConfig] = useState(true);
  const [preserveProperties, setPreserveProperties] = useState(true);
  const [customPreserve, setCustomPreserve] = useState("");

  const [excludeLogs, setExcludeLogs] = useState(true);
  const [excludeBackups, setExcludeBackups] = useState(true);
  const [excludeCache, setExcludeCache] = useState(true);
  const [excludeCrashReports, setExcludeCrashReports] = useState(true);
  const [customExclude, setCustomExclude] = useState("");

  const [wipeExisting, setWipeExisting] = useState(true);

  // Pull Test & Preview States
  const [testingPullConn, setTestingPullConn] = useState(false);
  const [pullConnResult, setPullConnResult] = useState<{ success: boolean; message: string } | null>(null);

  const [previewingPull, setPreviewingPull] = useState(false);
  const [pullManifest, setPullManifest] = useState<PullManifest | null>(null);
  const [showManifestModal, setShowManifestModal] = useState(false);

  // Pull Execution State
  const [pullConfirmed, setPullConfirmed] = useState(false);
  const [pullForceStop, setPullForceStop] = useState(false);
  const [startingPull, setStartingPull] = useState(false);
  const [activePullJobId, setActivePullJobId] = useState<string | null>(null);
  const [pullJob, setPullJob] = useState<SftpJob | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REMOTE SFTP TRANSFER STATE (EXPORT)
  // ─────────────────────────────────────────────────────────────────────────────
  const [xferHost, setXferHost] = useState("");
  const [xferPort, setXferPort] = useState("22");
  const [xferUsername, setXferUsername] = useState("");
  const [xferPassword, setXferPassword] = useState("");
  const [xferPrivateKey, setXferPrivateKey] = useState("");
  const [xferRemotePath, setXferRemotePath] = useState(`/rubber-backup-${id.slice(0, 8)}`);
  const [showXferPassword, setShowXferPassword] = useState(false);
  const [showXferKeyArea, setShowXferKeyArea] = useState(false);

  const [xferExcludeLogs, setXferExcludeLogs] = useState(true);
  const [xferExcludeBackups, setXferExcludeBackups] = useState(true);
  const [xferExcludeCache, setXferExcludeCache] = useState(true);
  const [xferCustomExclude, setXferCustomExclude] = useState("");

  const [testingXferConn, setTestingXferConn] = useState(false);
  const [xferConnResult, setXferConnResult] = useState<{ success: boolean; message: string } | null>(null);

  const [xferConfirmOpen, setXferConfirmOpen] = useState(false);
  const [startingXfer, setStartingXfer] = useState(false);
  const [activeXferJobId, setActiveXferJobId] = useState<string | null>(null);
  const [xferJob, setXferJob] = useState<SftpJob | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. NODE-TO-NODE CLUSTER MIGRATION STATE
  // ─────────────────────────────────────────────────────────────────────────────
  const [clusterLoading, setClusterLoading] = useState(false);
  const [availableNodes, setAvailableNodes] = useState<AvailableNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [activeClusterTransfer, setActiveClusterTransfer] = useState<ActiveNodeTransfer | null>(null);
  const [clusterExcludeLogs, setClusterExcludeLogs] = useState(true);
  const [clusterExcludeBackups, setClusterExcludeBackups] = useState(true);
  const [clusterExcludeCache, setClusterExcludeCache] = useState(true);
  const [clusterAutoStart, setClusterAutoStart] = useState(true);
  const [clusterConfirmOpen, setClusterConfirmOpen] = useState(false);
  const [submittingCluster, setSubmittingCluster] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Build current preserve and exclude lists
  function getPullPreserveList(): string[] {
    const list: string[] = [];
    if (preserveWorld) list.push("world", "world_nether", "world_the_end");
    if (preservePlugins) list.push("plugins", "mods");
    if (preserveConfig) list.push("config");
    if (preserveProperties) list.push("server.properties");
    if (customPreserve.trim()) {
      list.push(...customPreserve.split(",").map(s => s.trim()).filter(Boolean));
    }
    return Array.from(new Set(list));
  }

  function getPullExcludeList(): string[] {
    const list: string[] = [];
    if (excludeLogs) list.push("logs");
    if (excludeBackups) list.push("backups");
    if (excludeCache) list.push(".cache", "cache");
    if (excludeCrashReports) list.push("crash-reports");
    if (customExclude.trim()) {
      list.push(...customExclude.split(",").map(s => s.trim()).filter(Boolean));
    }
    return Array.from(new Set(list));
  }

  function getXferExcludeList(): string[] {
    const list: string[] = [];
    if (xferExcludeLogs) list.push("logs");
    if (xferExcludeBackups) list.push("backups");
    if (xferExcludeCache) list.push(".cache", "cache");
    if (xferCustomExclude.trim()) {
      list.push(...xferCustomExclude.split(",").map(s => s.trim()).filter(Boolean));
    }
    return Array.from(new Set(list));
  }

  // Load Cluster Transfer Status
  const fetchClusterStatus = useCallback(async () => {
    if (!allowCluster) return;
    setClusterLoading(true);
    try {
      const res = await fetch(`/api/user/servers/${id}/transfer`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNodes(data.availableNodes || []);
        setActiveClusterTransfer(data.activeTransfer);
        if (data.availableNodes?.length > 0 && !selectedNodeId) {
          setSelectedNodeId(data.availableNodes[0].id);
        }
      }
    } catch {}
    setClusterLoading(false);
  }, [id, allowCluster, selectedNodeId]);

  useEffect(() => {
    if (activeTab === "cluster") {
      fetchClusterStatus();
    }
  }, [activeTab, fetchClusterStatus]);

  // Poll active cluster transfer
  useEffect(() => {
    if (!activeClusterTransfer) return;
    if (activeClusterTransfer.status === "COMPLETED" || activeClusterTransfer.status === "FAILED") {
      refreshServer();
      return;
    }
    const timer = setInterval(() => {
      fetchClusterStatus();
      refreshServer();
    }, 2000);
    return () => clearInterval(timer);
  }, [activeClusterTransfer, fetchClusterStatus, refreshServer]);

  // ─────────────────────────────────────────────────────────────────────────────
  // POLLING FOR ACTIVE PULL JOB
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activePullJobId) return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/user/servers/${id}/remote-sftp?jobId=${encodeURIComponent(activePullJobId)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.job) {
            setPullJob(data.job);
            if (data.job.status === "completed") {
              setSuccess("Remote server pull completed successfully! Files have been unpacked.");
              clearInterval(interval);
              refreshServer();
            } else if (data.job.status === "failed") {
              setError(data.job.error || "Server pull failed.");
              clearInterval(interval);
            }
          }
        }
      } catch {}
    }, 1500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activePullJobId, id, refreshServer]);

  // ─────────────────────────────────────────────────────────────────────────────
  // POLLING FOR ACTIVE TRANSFER JOB
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeXferJobId) return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/user/servers/${id}/remote-sftp?jobId=${encodeURIComponent(activeXferJobId)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.job) {
            setXferJob(data.job);
            if (data.job.status === "completed") {
              setSuccess("Server transfer completed successfully! Files have been uploaded to remote host.");
              clearInterval(interval);
            } else if (data.job.status === "failed") {
              setError(data.job.error || "Server transfer failed.");
              clearInterval(interval);
            }
          }
        }
      } catch {}
    }, 1500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeXferJobId, id]);

  // Auto-scroll terminal logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pullJob?.logs, xferJob?.logs]);

  // ─── Test Pull SFTP Connection ─────────────────────────────────────────────
  async function handleTestPullConnection() {
    if (!pullHost || !pullUsername) {
      setError("Please specify remote host and username to test connection.");
      return;
    }
    setError("");
    setTestingPullConn(true);
    setPullConnResult(null);

    try {
      const res = await fetch(`/api/user/servers/${id}/remote-sftp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          host: pullHost,
          port: pullPort,
          username: pullUsername,
          password: pullPassword,
          privateKey: pullPrivateKey,
          remotePath: pullRemotePath,
        }),
      });
      const data = await res.json();
      setPullConnResult(data);
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Connection test failed.");
      }
    } catch {
      setError("Network error testing SFTP connection.");
    }
    setTestingPullConn(false);
  }

  // ─── Preview Pull Manifest (Detailed Overwrite Warnings) ───────────────────
  async function handlePreviewPull() {
    if (!pullHost || !pullUsername) {
      setError("Please specify remote host and username to preview pull.");
      return;
    }
    setError("");
    setPreviewingPull(true);
    setPullManifest(null);

    try {
      const res = await fetch(`/api/user/servers/${id}/remote-sftp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview-pull",
          host: pullHost,
          port: pullPort,
          username: pullUsername,
          password: pullPassword,
          privateKey: pullPrivateKey,
          remotePath: pullRemotePath,
          preservePaths: getPullPreserveList(),
          excludePaths: getPullExcludeList(),
          wipeExisting,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.manifest) {
        setPullManifest(data.manifest);
        setShowManifestModal(true);
      } else {
        setError(data.error || "Failed to generate pull preview manifest.");
      }
    } catch {
      setError("Network error previewing remote pull.");
    }
    setPreviewingPull(false);
  }

  // ─── Start Pull Execution ──────────────────────────────────────────────────
  async function handleExecutePull() {
    setError("");
    setStartingPull(true);

    try {
      const isRunning = server?.status === "RUNNING";
      const res = await fetch(`/api/user/servers/${id}/remote-sftp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pull",
          host: pullHost,
          port: pullPort,
          username: pullUsername,
          password: pullPassword,
          privateKey: pullPrivateKey,
          remotePath: pullRemotePath,
          preservePaths: getPullPreserveList(),
          excludePaths: getPullExcludeList(),
          wipeExisting,
          forceStop: isRunning && pullForceStop,
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActivePullJobId(data.jobId);
        setShowManifestModal(false);
        setSuccess("Pull operation initiated! Streaming files from remote SFTP host.");
      } else {
        setError(data.error || "Failed to start pull operation.");
      }
    } catch {
      setError("Network error initiating server pull.");
    }
    setStartingPull(false);
  }

  // ─── Test Transfer SFTP Connection ─────────────────────────────────────────
  async function handleTestXferConnection() {
    if (!xferHost || !xferUsername) {
      setError("Please specify target host and username to test connection.");
      return;
    }
    setError("");
    setTestingXferConn(true);
    setXferConnResult(null);

    try {
      const res = await fetch(`/api/user/servers/${id}/remote-sftp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          host: xferHost,
          port: xferPort,
          username: xferUsername,
          password: xferPassword,
          privateKey: xferPrivateKey,
          remotePath: xferRemotePath,
        }),
      });
      const data = await res.json();
      setXferConnResult(data);
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Target connection test failed.");
      }
    } catch {
      setError("Network error testing target SFTP connection.");
    }
    setTestingXferConn(false);
  }

  // ─── Start Transfer Execution ──────────────────────────────────────────────
  async function handleExecuteTransfer() {
    setError("");
    setStartingXfer(true);

    try {
      const res = await fetch(`/api/user/servers/${id}/remote-sftp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          host: xferHost,
          port: xferPort,
          username: xferUsername,
          password: xferPassword,
          privateKey: xferPrivateKey,
          remotePath: xferRemotePath,
          excludePaths: getXferExcludeList(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActiveXferJobId(data.jobId);
        setXferConfirmOpen(false);
        setSuccess("Transfer initiated! Uploading server files to remote SFTP host.");
      } else {
        setError(data.error || "Failed to start transfer operation.");
      }
    } catch {
      setError("Network error initiating server transfer.");
    }
    setStartingXfer(false);
  }

  // ─── Start Cluster Migration ───────────────────────────────────────────────
  async function handleStartClusterMigration() {
    if (!selectedNodeId) return;
    setSubmittingCluster(true);
    setError("");

    const excludePaths: string[] = [];
    if (clusterExcludeLogs) excludePaths.push("logs");
    if (clusterExcludeBackups) excludePaths.push("backups");
    if (clusterExcludeCache) excludePaths.push(".cache", "cache");

    try {
      const res = await fetch(`/api/user/servers/${id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetNodeId: selectedNodeId,
          excludePaths,
          autoStartAfter: clusterAutoStart,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setClusterConfirmOpen(false);
        setSuccess("Node-to-node migration initiated!");
        fetchClusterStatus();
      } else {
        setError(data.error || "Failed to initiate node migration.");
      }
    } catch {
      setError("Network error initiating node migration.");
    }
    setSubmittingCluster(false);
  }

  const isServerRunning = server?.status === "RUNNING";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── Top Header Card ─────────────────────────────────────────────────── */}
      <div className="saas-card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(56,189,248,0.12)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeftRight size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
                Server Transfer &amp; Migration
              </h2>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                Import your server from an external host, export to offsite storage, or migrate between nodes.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-Tab Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-surface-elevated)", padding: 4, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => setActiveTab("pull")}
            disabled={!allowRemote}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: activeTab === "pull" ? 700 : 500,
              background: activeTab === "pull" ? "var(--btn-primary-bg, #0284c7)" : "transparent",
              color: activeTab === "pull" ? "#ffffff" : "var(--text-muted)",
              border: "none",
              cursor: allowRemote ? "pointer" : "not-allowed",
              opacity: allowRemote ? 1 : 0.4,
              transition: "all 0.15s ease",
            }}
          >
            <Download size={14} />
            <span>Pull Server (Import)</span>
          </button>

          <button
            onClick={() => setActiveTab("transfer")}
            disabled={!allowRemote}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: activeTab === "transfer" ? 700 : 500,
              background: activeTab === "transfer" ? "var(--btn-primary-bg, #0284c7)" : "transparent",
              color: activeTab === "transfer" ? "#ffffff" : "var(--text-muted)",
              border: "none",
              cursor: allowRemote ? "pointer" : "not-allowed",
              opacity: allowRemote ? 1 : 0.4,
              transition: "all 0.15s ease",
            }}
          >
            <Upload size={14} />
            <span>Transfer Server (Export)</span>
          </button>

          {allowCluster && (
            <button
              onClick={() => setActiveTab("cluster")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: activeTab === "cluster" ? 700 : 500,
                background: activeTab === "cluster" ? "var(--btn-primary-bg, #0284c7)" : "transparent",
                color: activeTab === "cluster" ? "#ffffff" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Server size={14} />
              <span>Node Migration</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Permission Alert Banner if Disabled ─────────────────────────────── */}
      {!allowRemote && activeTab !== "cluster" && (
        <div style={{ padding: "14px 18px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "var(--radius-md)", color: "#facc15", display: "flex", alignItems: "center", gap: 12 }}>
          <Lock size={18} style={{ flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Remote SFTP Feature Disabled by Administrator</span>
            <p style={{ fontSize: 12, color: "rgba(250,204,21,0.85)", marginTop: 2 }}>
              Remote SFTP Pull &amp; Transfer is currently restricted on this server. Contact your panel administrator to enable this permission in Server Settings.
            </p>
          </div>
        </div>
      )}

      {/* ─── Feedback Alerts ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div style={{ padding: "12px 16px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-sm)", color: "#34d399", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: PULL SERVER (IMPORT VIA SFTP)                                    */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "pull" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Active Pull In Progress Banner */}
          {pullJob && (pullJob.status === "running" || pullJob.status === "completed" || pullJob.status === "failed") && (
            <div className="saas-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: pullJob.status === "completed" ? "rgba(34,197,94,0.15)" : pullJob.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(56,189,248,0.15)",
                    color: pullJob.status === "completed" ? "#22c55e" : pullJob.status === "failed" ? "#ef4444" : "#38bdf8",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {pullJob.status === "running" ? <Loader2 size={20} className="spin" /> : pullJob.status === "completed" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                      {pullJob.status === "running" ? "Pulling Server from SFTP Host..." : pullJob.status === "completed" ? "SFTP Pull Completed!" : "SFTP Pull Failed"}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {pullJob.currentFile}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-pure)" }}>
                    {pullJob.progressPercent}%
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)" }}>
                    {pullJob.transferredFiles} / {pullJob.totalFiles} files ({(pullJob.transferredBytes / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ width: "100%", height: 8, background: "var(--bg-surface-elevated)", borderRadius: 9999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pullJob.progressPercent}%`,
                    height: "100%",
                    background: pullJob.status === "completed" ? "#22c55e" : pullJob.status === "failed" ? "#ef4444" : "linear-gradient(90deg, #0ea5e9, #6366f1)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Real-time Streaming Logs Window */}
              <div style={{
                background: "#090d16",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                padding: "12px 14px",
                fontFamily: "monospace",
                fontSize: 12,
                color: "#94a3b8",
                maxHeight: 180,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}>
                {pullJob.logs.map((log, i) => (
                  <div key={i} style={{ color: log.includes("[Error]") || log.includes("[Fatal") ? "#f87171" : log.includes("[Preserved]") ? "#38bdf8" : log.includes("[Downloaded]") ? "#4ade80" : "#cbd5e1" }}>
                    {log}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {pullJob.status !== "running" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    onClick={() => { setActivePullJobId(null); setPullJob(null); }}
                    className="btn-secondary-dark"
                    style={{ padding: "8px 16px", fontSize: 12.5 }}
                  >
                    Close Log &amp; Reset
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form & Config Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 18 }}>
            {/* Left Card: Remote SFTP Credentials */}
            <div className="saas-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                <Key size={16} style={{ color: "#38bdf8" }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                  1. Remote SFTP Source
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                    SFTP Host / IP Address *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. sftp.example.com or 192.168.1.50"
                    value={pullHost}
                    onChange={(e) => setPullHost(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={pullPort}
                    onChange={(e) => setPullPort(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  SFTP Username *
                </label>
                <input
                  type="text"
                  placeholder="e.g. server123 or root"
                  value={pullUsername}
                  onChange={(e) => setPullUsername(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  SFTP Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPullPassword ? "text" : "password"}
                    placeholder="Enter remote SFTP password"
                    value={pullPassword}
                    onChange={(e) => setPullPassword(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "9px 38px 9px 12px", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPullPassword(!showPullPassword)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    {showPullPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Optional Private Key */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPullKeyArea(!showPullKeyArea)}
                  style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: 0 }}
                >
                  <span>{showPullKeyArea ? "− Hide SSH Private Key Option" : "+ Use SSH Private Key Instead"}</span>
                </button>
                {showPullKeyArea && (
                  <textarea
                    rows={4}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                    value={pullPrivateKey}
                    onChange={(e) => setPullPrivateKey(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", marginTop: 8, padding: "8px 10px", fontSize: 11, fontFamily: "monospace" }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Remote Directory Path
                </label>
                <input
                  type="text"
                  placeholder="/"
                  value={pullRemotePath}
                  onChange={(e) => setPullRemotePath(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace" }}
                />
                <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  Path on the remote host (e.g. <code>/</code>, <code>/home/container</code>, or <code>/minecraft</code>)
                </span>
              </div>

              {/* Test Connection Button & Result */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={handleTestPullConnection}
                  disabled={testingPullConn || !pullHost || !pullUsername}
                  className="btn-secondary-dark"
                  style={{ padding: "8px 16px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 7 }}
                >
                  {testingPullConn ? <Loader2 size={13} className="spin" /> : <Zap size={13} style={{ color: "#eab308" }} />}
                  <span>Test Connection</span>
                </button>

                {pullConnResult && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: pullConnResult.success ? "#34d399" : "#f87171" }}>
                    {pullConnResult.success ? <Check size={15} /> : <X size={15} />}
                    <span>{pullConnResult.success ? "Verified successfully" : "Connection failed"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Card: File Preservation & Exclusions */}
            <div className="saas-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                <ShieldCheck size={16} style={{ color: "#22c55e" }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                  2. Preservation &amp; Exclusion Rules
                </h3>
              </div>

              {/* Preserve Local Folders */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                  Preserve Existing Files on this Server (Will NOT be deleted or overwritten):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={preserveWorld} onChange={(e) => setPreserveWorld(e.target.checked)} />
                    <span>Worlds (<code>world</code>, etc.)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={preservePlugins} onChange={(e) => setPreservePlugins(e.target.checked)} />
                    <span>Plugins &amp; Mods</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={preserveConfig} onChange={(e) => setPreserveConfig(e.target.checked)} />
                    <span>Configuration Files</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={preserveProperties} onChange={(e) => setPreserveProperties(e.target.checked)} />
                    <span><code>server.properties</code></span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Additional preserve paths (comma separated, e.g. whitelist.json, ops.json)"
                  value={customPreserve}
                  onChange={(e) => setCustomPreserve(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", marginTop: 8, padding: "7px 10px", fontSize: 12 }}
                />
              </div>

              {/* Exclude from Remote Pull */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                  Exclude from Remote Pull (Skip downloading):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={excludeLogs} onChange={(e) => setExcludeLogs(e.target.checked)} />
                    <span>Logs (<code>logs/</code>)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={excludeBackups} onChange={(e) => setExcludeBackups(e.target.checked)} />
                    <span>Backups (<code>backups/</code>)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={excludeCache} onChange={(e) => setExcludeCache(e.target.checked)} />
                    <span>Caches (<code>.cache/</code>)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={excludeCrashReports} onChange={(e) => setExcludeCrashReports(e.target.checked)} />
                    <span>Crash Reports</span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Additional exclusions (comma separated, e.g. dynmap, temp)"
                  value={customExclude}
                  onChange={(e) => setCustomExclude(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", marginTop: 8, padding: "7px 10px", fontSize: 12 }}
                />
              </div>

              {/* Wipe Clean Switch */}
              <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#f87171" }}>Clean Slate Mode (Wipe Unpreserved Files)</span>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Removes obsolete local files that are not preserved, avoiding clutter from old server installations.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={wipeExisting}
                  onChange={(e) => setWipeExisting(e.target.checked)}
                  style={{ transform: "scale(1.2)", cursor: "pointer" }}
                />
              </div>

              {/* Preview Button */}
              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={handlePreviewPull}
                  disabled={previewingPull || !pullHost || !pullUsername}
                  className="btn-primary"
                  style={{ width: "100%", padding: "10px 18px", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {previewingPull ? <Loader2 size={16} className="spin" /> : <AlertTriangle size={16} />}
                  <span>Review Overwrite Warnings &amp; Pull</span>
                </button>
              </div>
            </div>
          </div>

          {/* ─── Pre-flight Manifest & Overwrite Warnings Modal ─────────────── */}
          {showManifestModal && pullManifest && (
            <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
                onClick={() => setShowManifestModal(false)}
              />
              <div
                className="card"
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 680,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  padding: 24,
                  boxShadow: "0 25px 50px rgba(0,0,0,0.7)",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {/* Modal Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(239,68,68,0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
                        Confirm Server Pull &amp; File Overwrites
                      </h3>
                      <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                        Review which files will be overwritten, deleted, and preserved before proceeding.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowManifestModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Server Online Warning */}
                {isServerRunning && (
                  <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Square size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 700, color: "#f87171" }}>Server is currently RUNNING!</span>
                      <p style={{ color: "rgba(248,113,113,0.9)", marginTop: 2 }}>
                        Overwriting files while the server process is alive will cause corrupted world chunks and JVM crashes.
                      </p>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={pullForceStop}
                          onChange={(e) => setPullForceStop(e.target.checked)}
                        />
                        <span>Safely stop server before writing files (Recommended)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Summary Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <div style={{ padding: "10px 12px", background: "var(--bg-surface-elevated)", borderRadius: 8, border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Incoming Files</span>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: "var(--text-pure)", marginTop: 2 }}>
                      {pullManifest.remoteFilesCount}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                      ({(pullManifest.remoteTotalBytes / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>

                  <div style={{ padding: "10px 12px", background: "rgba(234,179,8,0.08)", borderRadius: 8, border: "1px solid rgba(234,179,8,0.2)", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#facc15", textTransform: "uppercase" }}>Overwritten</span>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: "#facc15", marginTop: 2 }}>
                      {pullManifest.overwrittenFiles.length}
                    </span>
                    <span style={{ fontSize: 10.5, color: "rgba(250,204,21,0.7)" }}>existing files</span>
                  </div>

                  <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#f87171", textTransform: "uppercase" }}>Will Be Deleted</span>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: "#f87171", marginTop: 2 }}>
                      {pullManifest.deletedFiles.length}
                    </span>
                    <span style={{ fontSize: 10.5, color: "rgba(248,113,113,0.7)" }}>unpreserved files</span>
                  </div>

                  <div style={{ padding: "10px 12px", background: "rgba(34,197,94,0.08)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#4ade80", textTransform: "uppercase" }}>Preserved</span>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 800, color: "#4ade80", marginTop: 2 }}>
                      {pullManifest.preservedFiles.length}
                    </span>
                    <span style={{ fontSize: 10.5, color: "rgba(74,222,128,0.7)" }}>protected items</span>
                  </div>
                </div>

                {/* Detailed Manifest Accordions / Lists */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
                  {/* Overwritten Files */}
                  {pullManifest.overwrittenFiles.length > 0 && (
                    <div style={{ padding: 12, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.18)", borderRadius: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#facc15", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangle size={13} />
                        <span>Files to be overwritten ({pullManifest.overwrittenFiles.length}):</span>
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {pullManifest.overwrittenFiles.slice(0, 30).map((file, i) => (
                          <span key={i} style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(234,179,8,0.12)", color: "#fef08a", fontSize: 11, fontFamily: "monospace" }}>
                            {file}
                          </span>
                        ))}
                        {pullManifest.overwrittenFiles.length > 30 && (
                          <span style={{ fontSize: 11, color: "var(--text-dim)", alignSelf: "center" }}>
                            +{pullManifest.overwrittenFiles.length - 30} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deleted Files */}
                  {pullManifest.deletedFiles.length > 0 && (
                    <div style={{ padding: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171", display: "flex", alignItems: "center", gap: 6 }}>
                        <Trash2 size={13} />
                        <span>Non-preserved files to be removed ({pullManifest.deletedFiles.length}):</span>
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {pullManifest.deletedFiles.slice(0, 30).map((file, i) => (
                          <span key={i} style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 11, fontFamily: "monospace" }}>
                            {file}
                          </span>
                        ))}
                        {pullManifest.deletedFiles.length > 30 && (
                          <span style={{ fontSize: 11, color: "var(--text-dim)", alignSelf: "center" }}>
                            +{pullManifest.deletedFiles.length - 30} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preserved Files */}
                  {pullManifest.preservedFiles.length > 0 && (
                    <div style={{ padding: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", display: "flex", alignItems: "center", gap: 6 }}>
                        <ShieldCheck size={13} />
                        <span>Preserved local items (Will NOT be modified) ({pullManifest.preservedFiles.length}):</span>
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {pullManifest.preservedFiles.slice(0, 25).map((file, i) => (
                          <span key={i} style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "#86efac", fontSize: 11, fontFamily: "monospace" }}>
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Explicit Checkbox Confirmation */}
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-pure)", fontWeight: 600, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={pullConfirmed}
                      onChange={(e) => setPullConfirmed(e.target.checked)}
                      style={{ transform: "scale(1.2)" }}
                    />
                    <span>I understand and agree to overwrite and pull files from remote SFTP host.</span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowManifestModal(false)}
                    className="btn-secondary-dark"
                    style={{ padding: "9px 18px", fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePull}
                    disabled={!pullConfirmed || startingPull}
                    className="btn-primary"
                    style={{
                      padding: "9px 20px",
                      fontSize: 13,
                      fontWeight: 700,
                      background: pullConfirmed ? "#ef4444" : "var(--border-subtle)",
                      cursor: pullConfirmed ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {startingPull ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
                    <span>{startingPull ? "Starting Pull..." : "Begin Remote Pull"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: TRANSFER SERVER (EXPORT VIA SFTP)                                */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "transfer" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Active Export In Progress Banner */}
          {xferJob && (xferJob.status === "running" || xferJob.status === "completed" || xferJob.status === "failed") && (
            <div className="saas-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: xferJob.status === "completed" ? "rgba(34,197,94,0.15)" : xferJob.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(168,85,247,0.15)",
                    color: xferJob.status === "completed" ? "#22c55e" : xferJob.status === "failed" ? "#ef4444" : "#a855f7",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {xferJob.status === "running" ? <Loader2 size={20} className="spin" /> : xferJob.status === "completed" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                      {xferJob.status === "running" ? "Exporting Server to SFTP Target..." : xferJob.status === "completed" ? "SFTP Export Completed!" : "SFTP Export Failed"}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {xferJob.currentFile}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-pure)" }}>
                    {xferJob.progressPercent}%
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)" }}>
                    {xferJob.transferredFiles} / {xferJob.totalFiles} files ({(xferJob.transferredBytes / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ width: "100%", height: 8, background: "var(--bg-surface-elevated)", borderRadius: 9999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${xferJob.progressPercent}%`,
                    height: "100%",
                    background: xferJob.status === "completed" ? "#22c55e" : xferJob.status === "failed" ? "#ef4444" : "linear-gradient(90deg, #a855f7, #ec4899)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Terminal Logs */}
              <div style={{
                background: "#090d16",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                padding: "12px 14px",
                fontFamily: "monospace",
                fontSize: 12,
                color: "#94a3b8",
                maxHeight: 180,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}>
                {xferJob.logs.map((log, i) => (
                  <div key={i} style={{ color: log.includes("[Error]") || log.includes("[Fatal") ? "#f87171" : log.includes("[Uploaded]") ? "#a855f7" : "#cbd5e1" }}>
                    {log}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {xferJob.status !== "running" && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    onClick={() => { setActiveXferJobId(null); setXferJob(null); }}
                    className="btn-secondary-dark"
                    style={{ padding: "8px 16px", fontSize: 12.5 }}
                  >
                    Close Log &amp; Reset
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Transfer Form Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 18 }}>
            {/* Target SFTP Details */}
            <div className="saas-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                <Upload size={16} style={{ color: "#a855f7" }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                  Target SFTP Destination
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                    Destination Host / IP *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. backup.myserver.com or 10.0.0.1"
                    value={xferHost}
                    onChange={(e) => setXferHost(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={xferPort}
                    onChange={(e) => setXferPort(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  SFTP Username *
                </label>
                <input
                  type="text"
                  placeholder="e.g. user123 or backup_user"
                  value={xferUsername}
                  onChange={(e) => setXferUsername(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  SFTP Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showXferPassword ? "text" : "password"}
                    placeholder="Enter target SFTP password"
                    value={xferPassword}
                    onChange={(e) => setXferPassword(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "9px 38px 9px 12px", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowXferPassword(!showXferPassword)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    {showXferPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Private Key Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowXferKeyArea(!showXferKeyArea)}
                  style={{ background: "none", border: "none", color: "#a855f7", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: 0 }}
                >
                  <span>{showXferKeyArea ? "− Hide SSH Private Key Option" : "+ Use SSH Private Key Instead"}</span>
                </button>
                {showXferKeyArea && (
                  <textarea
                    rows={4}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                    value={xferPrivateKey}
                    onChange={(e) => setXferPrivateKey(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", marginTop: 8, padding: "8px 10px", fontSize: 11, fontFamily: "monospace" }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Destination Directory Path
                </label>
                <input
                  type="text"
                  value={xferRemotePath}
                  onChange={(e) => setXferRemotePath(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace" }}
                />
                <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  Directory will be created on the destination host if it does not already exist.
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={handleTestXferConnection}
                  disabled={testingXferConn || !xferHost || !xferUsername}
                  className="btn-secondary-dark"
                  style={{ padding: "8px 16px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 7 }}
                >
                  {testingXferConn ? <Loader2 size={13} className="spin" /> : <Zap size={13} style={{ color: "#a855f7" }} />}
                  <span>Test Target Connection</span>
                </button>

                {xferConnResult && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: xferConnResult.success ? "#34d399" : "#f87171" }}>
                    {xferConnResult.success ? <Check size={15} /> : <X size={15} />}
                    <span>{xferConnResult.success ? "Target reachable" : "Connection failed"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Card: Exclusions & Trigger */}
            <div className="saas-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 12 }}>
                <Layers size={16} style={{ color: "#38bdf8" }} />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                  Export Exclusions &amp; Options
                </h3>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                  Exclude from Transfer (Reduce transfer time and bandwidth):
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={xferExcludeLogs} onChange={(e) => setXferExcludeLogs(e.target.checked)} />
                    <span>Exclude <code>logs/</code> directory</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={xferExcludeBackups} onChange={(e) => setXferExcludeBackups(e.target.checked)} />
                    <span>Exclude <code>backups/</code> directory</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={xferExcludeCache} onChange={(e) => setXferExcludeCache(e.target.checked)} />
                    <span>Exclude temporary files and caches (<code>.cache/</code>)</span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Additional exclusions (comma separated, e.g. .git, crash-reports)"
                  value={xferCustomExclude}
                  onChange={(e) => setXferCustomExclude(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", marginTop: 10, padding: "7px 10px", fontSize: 12 }}
                />
              </div>

              {/* Safety notice */}
              <div style={{ padding: "12px 14px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Info size={16} style={{ color: "#38bdf8", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Transfer Integrity Tip:</span>
                  <p style={{ marginTop: 2 }}>
                    Server can remain running, but stopping it prior to export ensures that current player positions and level data in world folders are cleanly flushed to disk.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setXferConfirmOpen(true)}
                  disabled={startingXfer || !xferHost || !xferUsername}
                  className="btn-primary"
                  style={{ width: "100%", padding: "10px 18px", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #a855f7, #6366f1)" }}
                >
                  {startingXfer ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                  <span>Start Server Export (Transfer)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Transfer Confirmation Dialog */}
          <ConfirmationDialog
            open={xferConfirmOpen}
            title="Confirm Remote Server Export"
            description={`Are you sure you want to transfer all server files to ${xferHost}:${xferPort}${xferRemotePath}?`}
            confirmLabel="Confirm & Transfer"
            onConfirm={handleExecuteTransfer}
            onCancel={() => setXferConfirmOpen(false)}
            loading={startingXfer}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: NODE-TO-NODE CLUSTER MIGRATION                                   */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "cluster" && allowCluster && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Active Node Transfer View */}
          {activeClusterTransfer && (activeClusterTransfer.status === "PREPARING" || activeClusterTransfer.status === "TRANSFERRING" || activeClusterTransfer.status === "CONFIGURING") ? (
            <div className="saas-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                    <Loader2 size={20} className="spin" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                      Cluster Node Migration in Progress
                    </h3>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Transferring from {activeClusterTransfer.sourceNode?.name || "Source Node"} to {activeClusterTransfer.targetNode?.name || "Target Node"}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-pure)" }}>
                    {activeClusterTransfer.progress}%
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Status: {activeClusterTransfer.status}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: "100%", height: 8, background: "var(--bg-surface-elevated)", borderRadius: 9999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${activeClusterTransfer.progress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <div style={{ padding: "12px 16px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                <Zap size={15} style={{ color: "#38bdf8", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                  {activeClusterTransfer.currentStep || "Processing transfer pipeline..."}
                </span>
              </div>
            </div>
          ) : (
            /* Cluster Migration Setup */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* If last transfer failed, show error banner */}
              {activeClusterTransfer && activeClusterTransfer.status === "FAILED" && (
                <div className="saas-card" style={{ padding: "16px 20px", background: "rgba(244, 63, 94, 0.08)", border: "1px solid rgba(244, 63, 94, 0.3)", borderRadius: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <AlertCircle size={20} style={{ color: "#f43f5e", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#f43f5e" }}>
                        Node Migration Failed
                      </h4>
                      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                        {activeClusterTransfer.error || activeClusterTransfer.currentStep || "The transfer pipeline encountered an error. The server remains safely on its current node."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveClusterTransfer(null)}
                    className="btn-secondary-dark"
                    style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
                  >
                    Dismiss &amp; Retry
                  </button>
                </div>
              )}

              {/* If last transfer completed successfully, show success banner */}
              {activeClusterTransfer && activeClusterTransfer.status === "COMPLETED" && (
                <div className="saas-card" style={{ padding: "16px 20px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <CheckCircle2 size={20} style={{ color: "#34d399", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>
                        Node Migration Complete!
                      </h4>
                      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                        Server files, software, and configurations have been successfully cloned and mounted onto {activeClusterTransfer.targetNode?.name || "destination node"}.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveClusterTransfer(null)}
                    className="btn-secondary-dark"
                    style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
                {/* Current Node */}
                <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Current Node
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Server size={18} style={{ color: "var(--status-online)" }} />
                    <div>
                      <h4 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                        {server?.node?.name || "Current Node"}
                      </h4>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {server?.name} (RAM: {server?.ram} MB)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Node Selector */}
                <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Select Target Node ({availableNodes.length} Available)
                  </span>
                  <select
                    value={selectedNodeId}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
                  >
                    {availableNodes.map((node: any) => (
                      <option key={node.id} value={node.id} disabled={node.freeAllocations === 0}>
                        {node.name} {node.location ? `(${node.location})` : ""} {node.freeAllocations === 0 ? "— (No free ports)" : node.freeAllocations ? `— (${node.freeAllocations} ports free)` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Exclusion Options */}
              <div className="saas-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                  Migration Options
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={clusterExcludeLogs} onChange={(e) => setClusterExcludeLogs(e.target.checked)} />
                    <span>Exclude Logs</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={clusterExcludeBackups} onChange={(e) => setClusterExcludeBackups(e.target.checked)} />
                    <span>Exclude Backups</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={clusterExcludeCache} onChange={(e) => setClusterExcludeCache(e.target.checked)} />
                    <span>Exclude Cache</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={clusterAutoStart} onChange={(e) => setClusterAutoStart(e.target.checked)} />
                    <span>Auto-start after migration</span>
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    onClick={() => setClusterConfirmOpen(true)}
                    disabled={!selectedNodeId || submittingCluster}
                    className="btn-primary"
                    style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {submittingCluster ? <Loader2 size={15} className="spin" /> : <ArrowLeftRight size={15} />}
                    <span>Start Node Migration</span>
                  </button>
                </div>
              </div>

              <ConfirmationDialog
                open={clusterConfirmOpen}
                title="Confirm Node Migration"
                description={`Migrate server instance to the selected node? Server will be stopped during packaging.`}
                confirmLabel="Begin Migration"
                onConfirm={handleStartClusterMigration}
                onCancel={() => setClusterConfirmOpen(false)}
                loading={submittingCluster}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
