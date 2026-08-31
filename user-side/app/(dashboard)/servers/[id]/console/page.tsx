"use client";

import { useState, useEffect } from "react";
import { useServer } from "@/components/server/ServerContext";
import ConsolePanel from "@/components/server/ConsolePanel";
import { formatRam, getServerAddress } from "@/lib/server-utils";
import { copyToClipboard } from "@/lib/clipboard";
import { StatusPill } from "@/components/server/ServerCard";
import { Cpu, HardDrive, Activity, Globe, Layers, Copy, Check, ArrowUpRight, ArrowDownLeft, Zap } from "lucide-react";

interface LiveStats {
  status?: string;
  isCryoSleeping?: boolean;
  cpuUsage?: number;
  cpuLimit?: number;
  ramUsageMb?: number;
  ramLimitMb?: number;
  ramPercent?: number;
  diskUsedMb?: number;
  diskLimitMb?: number;
  diskPercent?: number;
  netRx?: string;
  netTx?: string;
}

export default function ConsolePage() {
  const { server } = useServer();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<LiveStats | null>(null);

  const isRunning = (stats?.status || server.status) === "RUNNING";
  const fullAddress = getServerAddress(server);

  // Poll live telemetry every 1.5s
  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const res = await fetch(`/api/user/servers/${server.id}/stats`);
        if (res.ok && mounted) {
          const data = await res.json();
          setStats(data);
        }
      } catch {}
    }

    fetchStats();
    const interval = setInterval(fetchStats, isRunning ? 1500 : 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [server.id, isRunning]);

  const handleCopy = async () => {
    if (!fullAddress || fullAddress === "—") return;
    await copyToClipboard(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Metric values
  const currentRamMb = stats?.ramUsageMb ?? (isRunning ? Math.round(server.ram * 0.25) : 0);
  const totalRamMb = stats?.ramLimitMb ?? server.ram ?? 1024;
  const ramPercent = stats?.ramPercent ?? (totalRamMb > 0 ? parseFloat(((currentRamMb / totalRamMb) * 100).toFixed(1)) : 0);

  const currentCpuPerc = stats?.cpuUsage ?? 0;
  const maxCpuLimit = stats?.cpuLimit ?? server.cpu ?? 100;
  const cpuPercentOfLimit = maxCpuLimit > 0 ? Math.min(100, Math.max(0, (currentCpuPerc / maxCpuLimit) * 100)) : 0;

  const currentDiskMb = stats?.diskUsedMb ?? (server.diskUsedMb || 0);
  const totalDiskMb = stats?.diskLimitMb ?? server.disk ?? 10240;
  const diskPercent = stats?.diskPercent ?? (totalDiskMb > 0 ? parseFloat(((currentDiskMb / totalDiskMb) * 100).toFixed(1)) : 0);

  // Color dynamics
  const ramColor = ramPercent > 90 ? "#ef4444" : ramPercent > 75 ? "#f59e0b" : "#38bdf8";
  const cpuColor = currentCpuPerc > (maxCpuLimit * 0.85) ? "#ef4444" : currentCpuPerc > (maxCpuLimit * 0.5) ? "#facc15" : "#4ade80";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* Stats Summary Row with 5 Real-Time Telemetry Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, width: "100%" }}>
        
        {/* 1. State Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Live State
            </span>
            <Activity size={13} style={{ color: isRunning ? "#4ade80" : stats?.isCryoSleeping ? "#38bdf8" : "var(--text-dim)" }} />
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <StatusPill status={stats?.status || server.status} suspended={server.suspended} />
            {stats?.isCryoSleeping && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                CRYO-SLEEP
              </span>
            )}
          </div>
        </div>

        {/* 2. Real-Time Memory (RAM) Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Memory (RAM)
            </span>
            <Layers size={13} style={{ color: ramColor }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)", marginTop: 6, display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <span>{currentRamMb} MB</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              / {formatRam(totalRamMb)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ramColor, marginLeft: "auto" }}>
              {ramPercent}%
            </span>
          </div>
          {/* Animated RAM Bar */}
          <div style={{ width: "100%", height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginTop: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: ramColor,
                width: `${Math.min(100, Math.max(isRunning ? 3 : 0, ramPercent))}%`,
                transition: "width 0.4s ease, background 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* 3. Real-Time Compute (CPU) Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Compute (CPU)
            </span>
            <Cpu size={13} style={{ color: cpuColor }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)", marginTop: 6, display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <span>{currentCpuPerc.toFixed(1)}%</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              / {maxCpuLimit}% ({(maxCpuLimit / 100).toFixed(1)} Cores)
            </span>
          </div>
          {/* Animated CPU Bar */}
          <div style={{ width: "100%", height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginTop: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: cpuColor,
                width: `${Math.min(100, Math.max(isRunning ? 2 : 0, cpuPercentOfLimit))}%`,
                transition: "width 0.4s ease, background 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* 4. Storage / NVMe Disk Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Storage (NVMe)
            </span>
            <HardDrive size={13} style={{ color: "#34d399" }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-pure)", marginTop: 6, display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <span>
              {currentDiskMb >= 1024
                ? `${(currentDiskMb / 1024).toFixed(2)} GB`
                : `${currentDiskMb} MB`}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              / {(totalDiskMb / 1024).toFixed(1)} GB
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", marginLeft: "auto" }}>
              {diskPercent}%
            </span>
          </div>
          <div style={{ width: "100%", height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginTop: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: "#10b981",
                width: `${Math.min(100, Math.max(2, diskPercent))}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* 5. Server Address & Full IP Card with Click to Copy + Live Network I/O */}
        <div
          className="saas-card"
          onClick={handleCopy}
          title="Click to copy full server address"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            cursor: "pointer",
            position: "relative",
            transition: "all 0.15s ease",
            border: copied ? "1px solid rgba(56, 189, 248, 0.5)" : undefined,
            background: copied ? "rgba(56, 189, 248, 0.08)" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Connection Address
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {copied ? (
                <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                  <Check size={11} /> Copied
                </span>
              ) : (
                <Globe size={13} style={{ color: "#38bdf8" }} />
              )}
            </div>
          </div>
          
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: copied ? "#38bdf8" : "var(--text-pure)",
              marginTop: 6,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={fullAddress}>
              {fullAddress}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "3px 6px",
                color: copied ? "#38bdf8" : "var(--text-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                flexShrink: 0,
              }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>

          {/* Live Network I/O Traffic Stats */}
          {isRunning && (stats?.netRx || stats?.netTx) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#38bdf8" }}>
                <ArrowDownLeft size={10} /> {stats.netRx || "0 B"}
              </span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#a78bfa" }}>
                <ArrowUpRight size={10} /> {stats.netTx || "0 B"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Console & Live Player Management */}
      <ConsolePanel serverId={server.id} status={stats?.status || server.status} />
    </div>
  );
}
