"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeftRight, Server, HardDrive, Cpu, Activity,
  Check, AlertCircle, Loader2, CheckCircle2, ShieldAlert,
  ArrowRight, RefreshCw, Zap, Shield, Play, Ban, RotateCcw
} from "lucide-react";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface AvailableNode {
  id: string;
  name: string;
  location?: string | null;
  status: string;
}

interface ActiveTransfer {
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

export default function ServerTransferPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [serverInfo, setServerInfo] = useState<any>(null);
  const [availableNodes, setAvailableNodes] = useState<AvailableNode[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);

  // Form State
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [excludeLogs, setExcludeLogs] = useState(true);
  const [excludeBackups, setExcludeBackups] = useState(true);
  const [excludeCache, setExcludeCache] = useState(true);
  const [autoStart, setAutoStart] = useState(true);

  // Confirmation & Action State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchTransferStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/servers/${id}/transfer`);
      if (res.ok) {
        const data = await res.json();
        setServerInfo(data.server);
        setAvailableNodes(data.availableNodes || []);
        setActiveTransfer(data.activeTransfer);
        if (data.availableNodes?.length > 0 && !selectedNodeId) {
          setSelectedNodeId(data.availableNodes[0].id);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load node transfer data.");
      }
    } catch {
      setError("Network error fetching transfer options.");
    }
    setLoading(false);
  }, [id, selectedNodeId]);

  useEffect(() => {
    fetchTransferStatus();
  }, [fetchTransferStatus]);

  // Polling when active transfer is running
  useEffect(() => {
    if (!activeTransfer || activeTransfer.status === "COMPLETED" || activeTransfer.status === "FAILED") {
      return;
    }
    const interval = setInterval(fetchTransferStatus, 2000);
    return () => clearInterval(interval);
  }, [activeTransfer, fetchTransferStatus]);

  async function handleStartTransfer() {
    if (!selectedNodeId) return;
    setSubmitting(true);
    setError("");

    const excludePaths: string[] = [];
    if (excludeLogs) excludePaths.push("logs");
    if (excludeBackups) excludePaths.push("backups");
    if (excludeCache) {
      excludePaths.push(".cache");
      excludePaths.push("cache");
    }

    try {
      const res = await fetch(`/api/user/servers/${id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetNodeId: selectedNodeId,
          excludePaths,
          autoStartAfter: autoStart,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setConfirmOpen(false);
        setSuccess("Migration initiated! Transferring instance to target node.");
        fetchTransferStatus();
      } else {
        setError(data.error || "Failed to initiate transfer.");
      }
    } catch {
      setError("Network error initiating transfer.");
    }
    setSubmitting(false);
  }

  const isTransferInProgress = activeTransfer &&
    (activeTransfer.status === "PREPARING" || activeTransfer.status === "TRANSFERRING" || activeTransfer.status === "CONFIGURING");

  const selectedTargetNode = availableNodes.find((n) => n.id === selectedNodeId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Banner */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowLeftRight size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              Node-to-Node Migration
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Seamlessly migrate your server instance, world saves, plugins, and configurations to another physical node.
          </p>
        </div>

        <button
          onClick={fetchTransferStatus}
          className="btn-secondary-dark"
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          <RefreshCw size={12} className={loading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-sm)", color: "#34d399", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="saas-card" style={{ padding: 60, textAlign: "center" }}>
          <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px", color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading node cluster status...</span>
        </div>
      ) : isTransferInProgress ? (
        /* LIVE PROGRESS VIEW */
        <div className="saas-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                <Loader2 size={20} className="spin" />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                  Migration in Progress
                </h3>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Transferring from {activeTransfer.sourceNode?.name || "Source Node"} to {activeTransfer.targetNode?.name || "Target Node"}
                </span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-pure)" }}>
                {activeTransfer.progress}%
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>
                Status: {activeTransfer.status}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: "100%", height: 8, background: "var(--bg-surface-elevated)", borderRadius: 9999, overflow: "hidden" }}>
            <div
              style={{
                width: `${activeTransfer.progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Current Step Description */}
          <div style={{ padding: "12px 16px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={15} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
              {activeTransfer.currentStep || "Processing transfer pipeline..."}
            </span>
          </div>
        </div>
      ) : (
        /* MIGRATION WIZARD */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. Source & Destination Overview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
            {/* Current Node */}
            <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Current Host Node
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Server size={18} style={{ color: "var(--status-online)" }} />
                <div>
                  <h4 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    {serverInfo?.nodeName || "Primary Node"}
                  </h4>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {serverInfo?.name} (RAM: {serverInfo?.ram} MB)
                  </span>
                </div>
              </div>
            </div>

            {/* Destination Node Selector */}
            <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Select Target Node ({availableNodes.length} Available)
              </span>

              {availableNodes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "8px 0" }}>
                  No other online nodes are currently available in the cluster.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {availableNodes.map((node) => (
                    <label
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: selectedNodeId === node.id ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                        border: selectedNodeId === node.id ? "1px solid #ffffff" : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          name="targetNode"
                          checked={selectedNodeId === node.id}
                          onChange={() => setSelectedNodeId(node.id)}
                          style={{ accentColor: "#ffffff" }}
                        />
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-pure)" }}>
                            {node.name}
                          </span>
                          {node.location && (
                            <span style={{ fontSize: 11, color: "var(--text-dim)", display: "block" }}>
                              {node.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--status-online)", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                        ONLINE
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Migration Scope & Options */}
          <div className="saas-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
              Transfer Settings &amp; Optimizations
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={excludeLogs}
                  onChange={(e) => setExcludeLogs(e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Exclude /logs/ folder</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>Reduces archive size</span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={excludeBackups}
                  onChange={(e) => setExcludeBackups(e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Exclude /backups/ folder</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>Fastest transfer speeds</span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={excludeCache}
                  onChange={(e) => setExcludeCache(e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Exclude .cache / temp</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>Auto-regenerates on boot</span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  style={{ accentColor: "#ffffff", width: 15, height: 15 }}
                />
                <div>
                  <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>Auto-start after transfer</span>
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)" }}>Boots on target node</span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Safety Notice & Start Migration Action */}
          <div className="saas-card" style={{ padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, maxWidth: 600 }}>
              <ShieldAlert size={18} style={{ color: "#60a5fa", marginTop: 2, flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-pure)" }}>
                  Zero Data-Loss Migration
                </h4>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  The daemon will gracefully stop your server before archiving all world regions, plugins, and configs. Once verified on the target node, the server will restart with the same port or newly assigned IP.
                </p>
              </div>
            </div>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedNodeId || availableNodes.length === 0}
              className="btn-solid-white"
              style={{ padding: "8px 20px", fontSize: 13 }}
            >
              <ArrowLeftRight size={14} />
              <span>Start Node Transfer</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm Node Migration"
        description={`Are you sure you want to migrate server "${serverInfo?.name}" to node "${selectedTargetNode?.name}"? The server will temporarily stop during file transfer.`}
        confirmLabel="Initiate Migration"
        loading={submitting}
        onConfirm={handleStartTransfer}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
