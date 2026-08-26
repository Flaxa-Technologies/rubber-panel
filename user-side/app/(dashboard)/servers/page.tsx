"use client";

import { useEffect, useState } from "react";
import {
  Server, Sparkles, Plus, Cpu, HardDrive, Zap, X, Check,
  Loader2, AlertTriangle, Layers, Calendar, ArrowRight
} from "lucide-react";
import ServerCard from "@/components/server/ServerCard";
import EmptyState from "@/components/ui/EmptyState";
import { useServers } from "@/hooks/useServers";

interface QuotaInfo {
  id: string;
  name: string;
  maxRam: number;
  maxCpu: number;
  maxDisk: number;
  maxServers: number;
  usedRam: number;
  usedCpu: number;
  usedDisk: number;
  serverCount: number;
  remainingRam: number;
  remainingCpu: number;
  remainingDisk: number;
  remainingServers: number;
  allowServerCreation: boolean;
  isSuspended: boolean;
  isExpired: boolean;
  expiresAt?: string | null;
  gracePeriodDays: number;
}

export default function ServersPage() {
  const { servers, loading, reload } = useServers();
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // Server creation modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const [ramMb, setRamMb] = useState(1024);
  const [cpuPct, setCpuPct] = useState(100);
  const [diskMb, setDiskMb] = useState(5120);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  async function loadQuota() {
    try {
      const res = await fetch("/api/user/resources");
      if (res.ok) {
        const data = await res.json();
        setQuota(data.quota);
      }
    } catch {}
    setQuotaLoading(false);
  }

  useEffect(() => {
    loadQuota();
  }, []);

  async function handleCreateServer() {
    if (!serverName.trim()) {
      setCreateError("Please provide a server name.");
      return;
    }
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const res = await fetch("/api/user/servers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serverName.trim(),
          ram: ramMb,
          cpu: cpuPct,
          disk: diskMb,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreateSuccess(data.message || "Server created successfully!");
        setCreateModalOpen(false);
        setServerName("");
        await Promise.all([reload(), loadQuota()]);
      } else {
        setCreateError(data.error || "Failed to create server.");
      }
    } catch {
      setCreateError("Network error while creating server.");
    }
    setCreating(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
            Server Instances
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            {loading ? "Loading..." : `${servers.length} active instances`}
          </p>
        </div>

        {quota?.allowServerCreation && !quota?.isSuspended && !quota?.isExpired && (
          <button
            onClick={() => {
              setCreateError("");
              setCreateSuccess("");
              setRamMb(Math.min(1024, quota.remainingRam || 1024));
              setCpuPct(Math.min(100, quota.remainingCpu || 100));
              setDiskMb(Math.min(5120, quota.remainingDisk || 5120));
              setCreateModalOpen(true);
            }}
            className="saas-btn saas-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 10 }}
          >
            <Plus size={15} />
            <span>Create Instance from Quota</span>
          </button>
        )}
      </div>

      {/* Account Resource Pool Card */}
      {quota && (
        <div
          className="saas-card"
          style={{
            padding: 16,
            borderRadius: 16,
            background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>
                <Sparkles size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)" }}>
                  {quota.name}
                </h3>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Account Hardware Resource Pool &bull; {quota.serverCount} / {quota.maxServers} Server Slots Used
                </span>
              </div>
            </div>

            {quota.isSuspended ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                QUOTA FROZEN
              </span>
            ) : quota.isExpired ? (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(234,179,8,0.15)", color: "#facc15" }}>
                RENEWAL DUE
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                ACTIVE POOL
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "var(--text-muted)" }}>Memory Pool</span>
                <span style={{ fontWeight: 700, color: "#60a5fa" }}>{(quota.usedRam / 1024).toFixed(1)} / {(quota.maxRam / 1024).toFixed(0)} GB</span>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#3b82f6", width: `${Math.min(100, (quota.usedRam / quota.maxRam) * 100)}%` }} />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                {(quota.remainingRam / 1024).toFixed(1)} GB Available to expand
              </span>
            </div>

            <div style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "var(--text-muted)" }}>NVMe Storage</span>
                <span style={{ fontWeight: 700, color: "#34d399" }}>{(quota.usedDisk / 1024).toFixed(1)} / {(quota.maxDisk / 1024).toFixed(0)} GB</span>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#10b981", width: `${Math.min(100, (quota.usedDisk / quota.maxDisk) * 100)}%` }} />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                {(quota.remainingDisk / 1024).toFixed(1)} GB Available to expand
              </span>
            </div>

            <div style={{ padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "var(--text-muted)" }}>Compute Cores</span>
                <span style={{ fontWeight: 700, color: "#facc15" }}>{quota.usedCpu}% / {quota.maxCpu}%</span>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#eab308", width: `${Math.min(100, (quota.usedCpu / quota.maxCpu) * 100)}%` }} />
              </div>
              <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                {quota.remainingCpu}% Available to expand
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Instances Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="saas-card" style={{ height: 180, opacity: 0.5 }} />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="saas-card" style={{ padding: "64px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Server size={32} style={{ color: "var(--text-dim)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No instances yet</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {quota?.allowServerCreation
              ? "Use the button above to launch your first instance from your allocated resource quota!"
              : "Servers will appear here once allocated by an administrator."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} onActionComplete={() => setTimeout(reload, 2000)} />
          ))}
        </div>
      )}

      {/* ── Create Server from Quota Modal ── */}
      {createModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 540,
              borderRadius: 20,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(234,179,8,0.15)", color: "#facc15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>Launch New Instance</h3>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Provisioned directly from your quota budget</span>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {createError && (
                <div style={{ padding: 10, borderRadius: 10, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {createError}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  Server Instance Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. SMP Survival, Creative Hub, Modded 1.20"
                  className="saas-input"
                  style={{ width: "100%", height: 38, borderRadius: 10, padding: "0 12px", fontSize: 13 }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Memory Allocation (RAM)</span>
                  <span style={{ color: "#60a5fa", fontWeight: 700 }}>{(ramMb / 1024).toFixed(1)} GB ({ramMb} MB)</span>
                </div>
                <input
                  type="range"
                  min="512"
                  max={quota?.remainingRam || 2048}
                  step="512"
                  value={ramMb}
                  onChange={(e) => setRamMb(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#3b82f6" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  Max available in quota: {((quota?.remainingRam || 0) / 1024).toFixed(1)} GB
                </span>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Compute Allocation (CPU)</span>
                  <span style={{ color: "#facc15", fontWeight: 700 }}>{cpuPct}% ({(cpuPct / 100).toFixed(1)} Cores)</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max={quota?.remainingCpu || 200}
                  step="25"
                  value={cpuPct}
                  onChange={(e) => setCpuPct(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#eab308" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  Max available in quota: {quota?.remainingCpu || 0}%
                </span>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>NVMe Storage (Disk)</span>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>{(diskMb / 1024).toFixed(1)} GB ({diskMb} MB)</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max={quota?.remainingDisk || 10240}
                  step="1024"
                  value={diskMb}
                  onChange={(e) => setDiskMb(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#10b981" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  Max available in quota: {((quota?.remainingDisk || 0) / 1024).toFixed(1)} GB
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setCreateModalOpen(false)}
                className="saas-btn"
                style={{ padding: "8px 14px", fontSize: 12, borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateServer}
                disabled={creating || !serverName.trim()}
                className="saas-btn saas-btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, borderRadius: 10 }}
              >
                {creating ? <><Loader2 size={14} className="animate-spin" /> Provisioning...</> : <><Check size={14} /> Launch Server</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
