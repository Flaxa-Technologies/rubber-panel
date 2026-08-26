"use client";

import { useState } from "react";
import { useServer } from "@/components/server/ServerContext";
import ConsolePanel from "@/components/server/ConsolePanel";
import { formatRam, getServerAddress } from "@/lib/server-utils";
import { StatusPill } from "@/components/server/ServerCard";
import { Cpu, HardDrive, Activity, Globe, Layers, Copy, Check } from "lucide-react";

export default function ConsolePage() {
  const { server } = useServer();
  const isRunning = server.status === "RUNNING";
  const [copied, setCopied] = useState(false);

  const fullAddress = getServerAddress(server);

  const handleCopy = () => {
    if (!fullAddress || fullAddress === "—") return;
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* Stats Summary Row with 5 Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12, width: "100%" }}>
        {/* State Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              State
            </span>
            <Activity size={13} style={{ color: isRunning ? "var(--status-online)" : "var(--text-dim)" }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <StatusPill status={server.status} suspended={server.suspended} />
          </div>
        </div>

        {/* Memory (RAM) Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Memory (RAM)
            </span>
            <Layers size={13} style={{ color: "#60a5fa" }} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)", marginTop: 6 }}>
            {formatRam(server.ram)}
          </div>
        </div>

        {/* Storage / NVMe Disk Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Storage (NVMe)
            </span>
            <HardDrive size={13} style={{ color: "#34d399" }} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)", marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
            <span>
              {(server.diskUsedMb || 0) >= 1024
                ? `${((server.diskUsedMb || 0) / 1024).toFixed(2)} GB`
                : `${server.diskUsedMb || 0} MB`}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              / {(server.disk / 1024).toFixed(1)} GB
            </span>
          </div>
          <div style={{ width: "100%", height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginTop: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: "#10b981",
                width: `${Math.min(100, Math.max(2, ((server.diskUsedMb || 0) / server.disk) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* CPU Load Card */}
        <div className="saas-card" style={{ padding: "12px 14px", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Compute (CPU)
            </span>
            <Cpu size={13} style={{ color: "#facc15" }} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)", marginTop: 6 }}>
            {server.cpu}% ({(server.cpu / 100).toFixed(1)} Cores)
          </div>
        </div>

        {/* Server Address & Full IP Card with Click to Copy */}
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
              Server Address
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
        </div>
      </div>

      {/* Terminal Console & Live Player Management */}
      <ConsolePanel serverId={server.id} status={server.status} />
    </div>
  );
}
