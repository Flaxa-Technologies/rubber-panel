"use client";

import { useEffect, useState } from "react";
import {
  Sparkles, Cpu, HardDrive, Zap, Server as ServerIcon,
  RefreshCw, Check, AlertTriangle, Loader2, Plus,
  TrendingUp, Shield, Network, Clock, X, Terminal,
  Layers, ChevronRight, Boxes, Trash2, Copy
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ServerItem {
  id: string;
  name: string;
  ram: number;
  cpu: number;
  disk: number;
  baseRam?: number;
  baseCpu?: number;
  baseDisk?: number;
  extraRam?: number;
  extraCpu?: number;
  extraDisk?: number;
  isCreatedFromQuota?: boolean;
  status: string;
  suspended: boolean;
  allocations?: { id: string; port: number; ip?: string }[];
}

interface QuotaData {
  id: string;
  name: string;
  maxRam: number;
  maxCpu: number;
  maxDisk: number;
  maxServers: number;
  maxBackups: number;
  maxAllocations: number;
  usedRam: number;
  usedCpu: number;
  usedDisk: number;
  usedAllocations: number;
  usedBackups: number;
  serverCount: number;
  remainingRam: number;
  remainingCpu: number;
  remainingDisk: number;
  remainingAllocations: number;
  remainingBackups: number;
  remainingServers: number;
  allowServerCreation: boolean;
  isSuspended: boolean;
  isExpired: boolean;
  expiresAt?: string | null;
  gracePeriodDays: number;
  notes?: string | null;
}

interface SoftwareVersion {
  id: string;
  version: string;
  defaultJava?: number;
}

interface SoftwareItem {
  id: string;
  name: string;
  type: string;
  versions: SoftwareVersion[];
}

export default function UserResourcesPage() {
  const [hasCustomQuota, setHasCustomQuota] = useState(false);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Scaler sliders
  const [ramMb, setRamMb] = useState(1024);
  const [cpuPct, setCpuPct] = useState(100);
  const [diskMb, setDiskMb] = useState(5120);

  const [saving, setSaving] = useState(false);
  const [allocatingPort, setAllocatingPort] = useState(false);
  const [releasingPortId, setReleasingPortId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create Server Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [softwareList, setSoftwareList] = useState<SoftwareItem[]>([]);
  const [selectedSoftwareId, setSelectedSoftwareId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [newServerName, setNewServerName] = useState("");
  const [newRamMb, setNewRamMb] = useState(2048);
  const [newCpuPct, setNewCpuPct] = useState(100);
  const [newDiskMb, setNewDiskMb] = useState(5120);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/resources");
      if (res.ok) {
        const data = await res.json();
        setHasCustomQuota(data.hasCustomQuota);
        setQuota(data.quota);
        const serverList: ServerItem[] = data.servers || [];
        setServers(serverList);

        if (serverList.length > 0) {
          const current = serverList.find((s) => s.id === selectedServerId) || serverList[0];
          setSelectedServerId(current.id);
          setRamMb(current.ram);
          setCpuPct(current.cpu);
          setDiskMb(current.disk);
        }
      }
    } catch {
      setError("Failed to load account resource allocations.");
    }
    setLoading(false);
  }

  async function loadSoftware() {
    try {
      const res = await fetch("/api/user/software");
      if (res.ok) {
        const data = await res.json();
        const list: SoftwareItem[] = data.software || [];
        setSoftwareList(list);
        if (list.length > 0) {
          setSelectedSoftwareId(list[0].id);
          if (list[0].versions && list[0].versions.length > 0) {
            setSelectedVersionId(list[0].versions[0].id);
          }
        }
      }
    } catch {}
  }

  useEffect(() => {
    loadData();
    loadSoftware();
  }, []);

  function handleSelectServer(sId: string) {
    setSelectedServerId(sId);
    setError("");
    setSuccess("");
    const target = servers.find((s) => s.id === sId);
    if (target) {
      setRamMb(target.ram);
      setCpuPct(target.cpu);
      setDiskMb(target.disk);
    }
  }

  function handleSoftwareChange(sId: string) {
    setSelectedSoftwareId(sId);
    const sw = softwareList.find((s) => s.id === sId);
    if (sw && sw.versions && sw.versions.length > 0) {
      setSelectedVersionId(sw.versions[0].id);
    } else {
      setSelectedVersionId("");
    }
  }

  const selectedServer = servers.find((s) => s.id === selectedServerId);

  // Authoritative Base Plan Resources (user cannot scale below these)
  const baseServerRam = selectedServer?.isCreatedFromQuota ? 512 : (selectedServer?.baseRam ?? selectedServer?.ram ?? 1024);
  const baseServerCpu = selectedServer?.isCreatedFromQuota ? 25 : (selectedServer?.baseCpu ?? selectedServer?.cpu ?? 100);
  const baseServerDisk = selectedServer?.isCreatedFromQuota ? 1024 : (selectedServer?.baseDisk ?? selectedServer?.disk ?? 5120);

  const currentExtraRam = selectedServer?.isCreatedFromQuota ? selectedServer.ram : (selectedServer?.extraRam || 0);
  const currentExtraCpu = selectedServer?.isCreatedFromQuota ? selectedServer.cpu : (selectedServer?.extraCpu || 0);
  const currentExtraDisk = selectedServer?.isCreatedFromQuota ? selectedServer.disk : (selectedServer?.extraDisk || 0);

  // Maximum allowable ceiling = Base Plan + Current Extra Boost + Free Remaining Quota
  const maxAvailableRam = baseServerRam + currentExtraRam + (quota?.remainingRam || 0);
  const maxAvailableCpu = baseServerCpu + currentExtraCpu + (quota?.remainingCpu || 0);
  const maxAvailableDisk = baseServerDisk + currentExtraDisk + (quota?.remainingDisk || 0);

  // Delta relative to current server configured resources
  const currentServerTotalRam = selectedServer?.ram || baseServerRam;
  const currentServerTotalCpu = selectedServer?.cpu || baseServerCpu;
  const currentServerTotalDisk = selectedServer?.disk || baseServerDisk;

  const ramDelta = ramMb - currentServerTotalRam;
  const cpuDelta = cpuPct - currentServerTotalCpu;
  const diskDelta = diskMb - currentServerTotalDisk;
  const extraRamFromBase = Math.max(0, ramMb - baseServerRam);
  const extraCpuFromBase = Math.max(0, cpuPct - baseServerCpu);
  const extraDiskFromBase = Math.max(0, diskMb - baseServerDisk);

  const hasChanges = ramDelta !== 0 || cpuDelta !== 0 || diskDelta !== 0;

  async function handleApplyScale() {
    if (!selectedServerId || !hasChanges) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${selectedServerId}/scale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ram: ramMb,
          cpu: cpuPct,
          disk: diskMb,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Server resources successfully scaled!");
        await loadData();
      } else {
        setError(data.error || "Failed to scale server resources.");
      }
    } catch {
      setError("Network error while scaling server resources.");
    }
    setSaving(false);
  }

  async function handleAllocatePort() {
    if (!selectedServerId) return;
    setAllocatingPort(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${selectedServerId}/allocations`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Extra port successfully allotted to server!");
        await loadData();
      } else {
        setError(data.error || "Failed to allot port from quota.");
      }
    } catch {
      setError("Network error while allotting port.");
    }
    setAllocatingPort(false);
  }

  async function handleReleasePort(allocId: string) {
    if (!selectedServerId) return;
    setReleasingPortId(allocId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${selectedServerId}/allocations/${allocId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Port released back to quota pool!");
        await loadData();
      } else {
        setError(data.error || "Failed to release port.");
      }
    } catch {
      setError("Network error while releasing port.");
    }
    setReleasingPortId(null);
  }

  async function handleCreateServer() {
    if (!newServerName.trim()) {
      setCreateError("Please enter a name for your Minecraft server.");
      return;
    }
    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/user/servers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServerName.trim(),
          ram: newRamMb,
          cpu: newCpuPct,
          disk: newDiskMb,
          softwareId: selectedSoftwareId || undefined,
          softwareVersionId: selectedVersionId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreateModalOpen(false);
        setNewServerName("");
        setSuccess(data.message || "Minecraft server provisioned successfully!");
        await loadData();
      } else {
        setCreateError(data.error || "Failed to create server from quota.");
      }
    } catch {
      setCreateError("Network error while provisioning server.");
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div style={{ width: "100%", padding: "100px 20px", textAlign: "center" }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "#c084fc" }} />
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading your Account Resources...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, width: "100%" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
              Account Resource Pool &amp; Scaling
            </h1>
            {hasCustomQuota && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.25)" }}>
                Active Quota
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Manage your extra hardware resources, expand existing instances, or provision new Minecraft servers.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {quota?.allowServerCreation && !quota.isSuspended && !quota.isExpired && (
            <button
              onClick={() => {
                setCreateError("");
                setNewRamMb(Math.min(2048, quota.remainingRam || 2048));
                setNewCpuPct(Math.min(100, quota.remainingCpu || 100));
                setNewDiskMb(Math.min(5120, quota.remainingDisk || 5120));
                setCreateModalOpen(true);
              }}
              className="saas-btn saas-btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 10 }}
            >
              <Plus size={15} />
              <span>Launch Minecraft Server</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="saas-btn"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 14px", borderRadius: 10 }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* When NO Extra Resource Quota is Assigned */}
      {!hasCustomQuota || !quota ? (
        <div
          className="saas-card"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            background: "linear-gradient(145deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", marginBottom: 14 }}>
            <Sparkles size={24} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            No Extra Resource Quotas Assigned
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 500, marginTop: 6, lineHeight: 1.6 }}>
            Your account currently operates on standard instance plans. To expand existing servers with extra RAM/CPU/Disk/Ports or provision custom servers from a quota budget, contact your administrator.
          </p>
        </div>
      ) : (
        /* Real Account Extra Resource Pool Card */
        <div
          className="saas-card"
          style={{
            padding: 22,
            borderRadius: 18,
            width: "100%",
            background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Top Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(168,85,247,0.15)", color: "#c084fc" }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
                  {quota.name}
                </h3>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {quota.notes || "Extra hardware quota pool allotted to your account"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {quota.isSuspended ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                  QUOTA FROZEN &bull; SUSPENDED
                </span>
              ) : quota.isExpired ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "rgba(234,179,8,0.15)", color: "#facc15", border: "1px solid rgba(234,179,8,0.25)" }}>
                  EXPIRED &bull; {quota.gracePeriodDays}D GRACE PERIOD
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                  ACTIVE &bull; UNLOCKED
                </span>
              )}

              {quota.expiresAt && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Clock size={13} />
                  <span>Renews: {new Date(quota.expiresAt).toLocaleDateString()}</span>
                </span>
              )}
            </div>
          </div>

          {/* 5-Column Resource Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, width: "100%" }}>
            {/* RAM */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Extra Memory (RAM)</span>
                <span style={{ fontWeight: 700, color: "#60a5fa" }}>{(quota.remainingRam / 1024).toFixed(1)} GB Free</span>
              </div>
              <div style={{ width: "100%", height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#3b82f6", width: `${Math.min(100, (quota.usedRam / quota.maxRam) * 100)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                <span>Used: {(quota.usedRam / 1024).toFixed(1)} GB</span>
                <span>Total: {(quota.maxRam / 1024).toFixed(0)} GB</span>
              </div>
            </div>

            {/* NVMe Storage */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Extra NVMe Disk</span>
                <span style={{ fontWeight: 700, color: "#34d399" }}>{(quota.remainingDisk / 1024).toFixed(1)} GB Free</span>
              </div>
              <div style={{ width: "100%", height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#10b981", width: `${Math.min(100, (quota.usedDisk / quota.maxDisk) * 100)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                <span>Used: {(quota.usedDisk / 1024).toFixed(1)} GB</span>
                <span>Total: {(quota.maxDisk / 1024).toFixed(0)} GB</span>
              </div>
            </div>

            {/* CPU Compute */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Extra Compute (CPU)</span>
                <span style={{ fontWeight: 700, color: "#facc15" }}>{quota.remainingCpu}% Free</span>
              </div>
              <div style={{ width: "100%", height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#eab308", width: `${Math.min(100, (quota.usedCpu / quota.maxCpu) * 100)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                <span>Used: {quota.usedCpu}%</span>
                <span>Total: {quota.maxCpu}%</span>
              </div>
            </div>

            {/* Server Slots */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Server Slots</span>
                <span style={{ fontWeight: 700, color: "#c084fc" }}>{quota.remainingServers} Free</span>
              </div>
              <div style={{ width: "100%", height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#a855f7", width: `${Math.min(100, (quota.serverCount / quota.maxServers) * 100)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                <span>Used: {quota.serverCount} Slots</span>
                <span>Total: {quota.maxServers} Slots</span>
              </div>
            </div>

            {/* Ports */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Extra Ports</span>
                <span style={{ fontWeight: 700, color: "#38bdf8" }}>{quota.remainingAllocations} Free</span>
              </div>
              <div style={{ width: "100%", height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#0ea5e9", width: `${Math.min(100, ((quota.usedAllocations || 0) / (quota.maxAllocations || 1)) * 100)}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                <span>Used: {quota.usedAllocations} Ports</span>
                <span>Total: {quota.maxAllocations} Ports</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div style={{ padding: 14, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", width: "100%" }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: 14, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13, background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)", width: "100%" }}>
          <Check size={18} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {/* Instance Hardware Scaler Section */}
      {servers.length > 0 && hasCustomQuota && quota && (
        <div
          className="saas-card"
          style={{
            padding: 24,
            borderRadius: 18,
            width: "100%",
            background: "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Top Selector */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-pure)" }}>
                Instance Hardware Scaler
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                Expand or reduce hardware limits on demand using your available extra quota headroom.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Select Instance:</span>
              <select
                value={selectedServerId}
                onChange={(e) => handleSelectServer(e.target.value)}
                className="saas-input"
                style={{ height: 38, padding: "0 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "var(--text-pure)", background: "rgba(0,0,0,0.4)" }}
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({(s.ram / 1024).toFixed(1)}GB RAM / {s.cpu}%) {s.isCreatedFromQuota ? "• [Quota Instance]" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, width: "100%" }}>
            {/* Sliders Area */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* RAM */}
              <div style={{ padding: 16, borderRadius: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Cpu size={16} style={{ color: "#60a5fa" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-pure)" }}>Memory Allocation (RAM)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>{(ramMb / 1024).toFixed(1)} GB</span>
                    {extraRamFromBase > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>
                        +{(extraRamFromBase / 1024).toFixed(1)} GB Quota Boost
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        (Base Plan Only)
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={baseServerRam}
                  max={Math.max(ramMb, maxAvailableRam)}
                  step="512"
                  value={ramMb}
                  onChange={(e) => setRamMb(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#3b82f6" }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  <span>Base Plan: {(baseServerRam / 1024).toFixed(1)} GB (Locked Min)</span>
                  <span>Pool Ceiling: {(maxAvailableRam / 1024).toFixed(1)} GB</span>
                </div>
              </div>

              {/* CPU */}
              <div style={{ padding: 16, borderRadius: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Zap size={16} style={{ color: "#facc15" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-pure)" }}>Compute Allocation (CPU)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#facc15" }}>{cpuPct}% ({(cpuPct / 100).toFixed(1)} Cores)</span>
                    {extraCpuFromBase > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(234,179,8,0.15)", color: "#facc15", border: "1px solid rgba(234,179,8,0.25)" }}>
                        +{extraCpuFromBase}% Quota Boost
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        (Base Plan Only)
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={baseServerCpu}
                  max={Math.max(cpuPct, maxAvailableCpu)}
                  step="25"
                  value={cpuPct}
                  onChange={(e) => setCpuPct(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#eab308" }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  <span>Base Plan: {baseServerCpu}% (Locked Min)</span>
                  <span>Pool Ceiling: {maxAvailableCpu}%</span>
                </div>
              </div>

              {/* Disk */}
              <div style={{ padding: 16, borderRadius: 14, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <HardDrive size={16} style={{ color: "#34d399" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-pure)" }}>NVMe Storage (Disk)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>{(diskMb / 1024).toFixed(1)} GB</span>
                    {extraDiskFromBase > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                        +{(extraDiskFromBase / 1024).toFixed(1)} GB Quota Boost
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        (Base Plan Only)
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={baseServerDisk}
                  max={Math.max(diskMb, maxAvailableDisk)}
                  step="1024"
                  value={diskMb}
                  onChange={(e) => setDiskMb(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#10b981" }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  <span>Base Plan: {(baseServerDisk / 1024).toFixed(1)} GB (Locked Min)</span>
                  <span>Pool Ceiling: {(maxAvailableDisk / 1024).toFixed(0)} GB</span>
                </div>
              </div>
            </div>

            {/* Summary & Apply Panel */}
            <div style={{ padding: 20, borderRadius: 16, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                Scaling Summary
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Target Instance</span>
                  <span style={{ fontWeight: 600, color: "var(--text-pure)" }}>{selectedServer?.name}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total RAM</span>
                  <span style={{ fontWeight: 700, color: "#60a5fa" }}>{(ramMb / 1024).toFixed(1)} GB ({ramMb} MB)</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total CPU</span>
                  <span style={{ fontWeight: 700, color: "#facc15" }}>{cpuPct}% ({(cpuPct / 100).toFixed(1)} Cores)</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total NVMe Disk</span>
                  <span style={{ fontWeight: 700, color: "#34d399" }}>{(diskMb / 1024).toFixed(1)} GB ({diskMb} MB)</span>
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 12, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)", fontSize: 12, color: "var(--text-muted)", marginTop: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#c084fc", marginBottom: 3 }}>
                  <TrendingUp size={14} />
                  <span>Dynamic Live Scaling</span>
                </div>
                Hardware limits are rebalanced live without destroying or corrupting container files.
              </div>

              <button
                onClick={handleApplyScale}
                disabled={saving || !hasChanges || quota.isSuspended}
                className="saas-btn saas-btn-primary"
                style={{
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 10,
                  cursor: !hasChanges || quota.isSuspended ? "not-allowed" : "pointer",
                  opacity: !hasChanges || quota.isSuspended ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Applying Hardware Scale...</>
                ) : !hasChanges ? (
                  <><Check size={16} /> Current Allocation Active</>
                ) : (
                  <><TrendingUp size={16} /> Apply Resource Scaling</>
                )}
              </button>
            </div>
          </div>

          {/* ── Direct Extra Port Allotment Manager on Selected Server ── */}
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(56,189,248,0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Network size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                    Port Allocations for "{selectedServer?.name}"
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Allot extra service ports (Votifier, Bedrock, Dynmap, etc.) from your available quota
                  </span>
                </div>
              </div>

              {quota.remainingAllocations > 0 && !quota.isSuspended && (
                <button
                  onClick={handleAllocatePort}
                  disabled={allocatingPort}
                  className="saas-btn saas-btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 10 }}
                >
                  {allocatingPort ? (
                    <><Loader2 size={14} className="animate-spin" /> Allotting Port...</>
                  ) : (
                    <><Plus size={14} /> Allot Extra Port from Quota ({quota.remainingAllocations} Available)</>
                  )}
                </button>
              )}
            </div>

            {/* List of currently assigned ports */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {(selectedServer?.allocations || []).map((alloc, idx) => (
                <div
                  key={alloc.id || idx}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "var(--text-pure)" }}>
                      :{alloc.port}
                    </span>
                    {idx === 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                        Primary
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
                        Extra Port
                      </span>
                    )}
                  </div>

                  {idx > 0 && (
                    <button
                      onClick={() => handleReleasePort(alloc.id)}
                      disabled={releasingPortId === alloc.id}
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
                      title="Release port back to quota pool"
                    >
                      {releasingPortId === alloc.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
                      <span>Release</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Minecraft Server Self-Creation from Quota Modal ── */}
      {createModalOpen && quota && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(168,85,247,0.15)", color: "#c084fc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>Launch Minecraft Server</h3>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Provisioned directly from your active Resource Quota Pool</span>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {createError && (
                <div style={{ padding: 12, borderRadius: 12, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                  {createError}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  Server Instance Name
                </label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="e.g. SMP Survival, Paper 1.21.1, Modded Creative"
                  className="saas-input"
                  style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 14px", fontSize: 13 }}
                />
              </div>

              {/* Software & Version Selection */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                    Minecraft Software
                  </label>
                  <select
                    value={selectedSoftwareId}
                    onChange={(e) => handleSoftwareChange(e.target.value)}
                    className="saas-input"
                    style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", fontSize: 13, background: "rgba(0,0,0,0.3)" }}
                  >
                    {softwareList.map((sw) => (
                      <option key={sw.id} value={sw.id}>{sw.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                    Game Version
                  </label>
                  <select
                    value={selectedVersionId}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    className="saas-input"
                    style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", fontSize: 13, background: "rgba(0,0,0,0.3)" }}
                  >
                    {(softwareList.find((s) => s.id === selectedSoftwareId)?.versions || []).map((v) => (
                      <option key={v.id} value={v.id}>{v.version}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RAM Allocation */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Memory Allocation (RAM)</span>
                  <span style={{ color: "#60a5fa", fontWeight: 700 }}>{(newRamMb / 1024).toFixed(1)} GB ({newRamMb} MB)</span>
                </div>
                <input
                  type="range"
                  min="512"
                  max={quota.remainingRam || 2048}
                  step="512"
                  value={newRamMb}
                  onChange={(e) => setNewRamMb(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#3b82f6" }}
                />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Available in Quota Pool: {((quota.remainingRam || 0) / 1024).toFixed(1)} GB
                </span>
              </div>

              {/* CPU Allocation */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Compute Allocation (CPU)</span>
                  <span style={{ color: "#facc15", fontWeight: 700 }}>{newCpuPct}% ({(newCpuPct / 100).toFixed(1)} Cores)</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max={quota.remainingCpu || 200}
                  step="25"
                  value={newCpuPct}
                  onChange={(e) => setNewCpuPct(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#eab308" }}
                />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Available in Quota Pool: {quota.remainingCpu || 0}%
                </span>
              </div>

              {/* Disk Allocation */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>NVMe Storage (Disk)</span>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>{(newDiskMb / 1024).toFixed(1)} GB ({newDiskMb} MB)</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max={quota.remainingDisk || 10240}
                  step="1024"
                  value={newDiskMb}
                  onChange={(e) => setNewDiskMb(parseInt(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#10b981" }}
                />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Available in Quota Pool: {((quota.remainingDisk || 0) / 1024).toFixed(1)} GB
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "18px 24px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <button
                onClick={() => setCreateModalOpen(false)}
                className="saas-btn"
                style={{ padding: "8px 16px", fontSize: 13, borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateServer}
                disabled={creating || !newServerName.trim()}
                className="saas-btn saas-btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10 }}
              >
                {creating ? <><Loader2 size={15} className="animate-spin" /> Provisioning Node Workspace...</> : <><Check size={15} /> Launch Server</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
