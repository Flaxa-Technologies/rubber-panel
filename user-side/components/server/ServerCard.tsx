"use client";

import Link from "next/link";
import { Server, MemoryStick, Cpu, HardDrive, ArrowRight, Copy, Check, Moon, Zap, Code2, ExternalLink, Clock } from "lucide-react";
import type { UserServer } from "@/lib/types";
import { formatDisk, formatRam, getServerAddress } from "@/lib/server-utils";
import PowerControls from "./PowerControls";
import { useState } from "react";

interface ServerCardProps {
  server: UserServer;
  onActionComplete?: () => void;
}

export function StatusPill({ status, suspended }: { status: string; suspended: boolean }) {
  if (suspended) {
    return (
      <span className="status-pill">
        <span className="dot-indicator dot-stopping" />
        <span>Suspended</span>
      </span>
    );
  }

  switch (status) {
    case "RUNNING":
      return (
        <span className="status-pill" style={{ color: "#ffffff", borderColor: "var(--border-medium)" }}>
          <span className="dot-indicator dot-online" />
          <span>Online</span>
        </span>
      );
    case "SLEEPING":
      return (
        <span className="status-pill" style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.35)", background: "rgba(56, 189, 248, 0.1)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Moon size={11} style={{ color: "#38bdf8" }} />
          <span>Sleeping</span>
        </span>
      );
    case "WAKING":
      return (
        <span className="status-pill" style={{ color: "#facc15", borderColor: "rgba(250, 204, 21, 0.35)", background: "rgba(250, 204, 21, 0.1)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Zap size={11} className="spin" style={{ color: "#facc15" }} />
          <span>Waking Up</span>
        </span>
      );
    case "STARTING":
      return (
        <span className="status-pill">
          <span className="dot-indicator dot-starting spin" />
          <span>Starting</span>
        </span>
      );
    case "STOPPING":
      return (
        <span className="status-pill">
          <span className="dot-indicator dot-stopping" />
          <span>Stopping</span>
        </span>
      );
    default:
      return (
        <span className="status-pill">
          <span className="dot-indicator dot-offline" />
          <span>Offline</span>
        </span>
      );
  }
}

export default function ServerCard({ server, onActionComplete }: ServerCardProps) {
  const address = getServerAddress(server);
  const [copied, setCopied] = useState(false);
  const isSandbox = server.isSandbox || server.serverType === "CODESANDBOX";

  const softwareLabel = isSandbox
    ? `Code Sandbox · ${server.sandboxRuntime || "VS Code"}`
    : server.software
    ? `${server.software.name}${server.softwareVersion?.version ? ` ${server.softwareVersion.version}` : ""}`
    : server.serverType === "NODEJS"
    ? `Node.js v${server.nodeVersion || "20"}`
    : server.serverType === "PYTHON"
    ? "Python Runtime"
    : server.serverType === "RUST"
    ? "Rust Service"
    : server.serverType === "DATABASE"
    ? "Database Instance"
    : server.serverType === "CUSTOM"
    ? "Custom Container"
    : "Minecraft";

  const copyIp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (address && address !== "—") {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const primaryAlloc = server.allocations?.[0];
  const idePort = primaryAlloc?.port || 25590;
  const nodeFqdn = server.node?.fqdn || "localhost";
  const ideUrl = `http://${nodeFqdn}:${idePort}`;

  return (
    <div className="saas-card saas-card-interactive" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: isSandbox ? "rgba(163, 230, 53, 0.12)" : "var(--bg-surface-elevated)",
            border: isSandbox ? "1px solid rgba(163, 230, 53, 0.3)" : "1px solid var(--border-medium)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isSandbox ? "var(--accent-lime)" : "var(--text-secondary)",
            flexShrink: 0
          }}>
            {isSandbox ? <Code2 size={16} /> : <Server size={15} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <Link 
              href={`/servers/${server.id}`} 
              style={{ fontSize: 14, fontWeight: 600, color: "var(--text-pure)", display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
              className="hover:underline"
            >
              {server.name}
            </Link>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{server.node.name} · {softwareLabel}</span>
              {isSandbox && server.sandboxDailyHoursLimit !== undefined && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: server.sandboxDailyHoursLimit ? "rgba(56, 189, 248, 0.15)" : "rgba(163, 230, 53, 0.15)",
                  color: server.sandboxDailyHoursLimit ? "#38bdf8" : "var(--accent-lime)",
                  border: server.sandboxDailyHoursLimit ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(163, 230, 53, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}>
                  <Clock size={10} /> {server.sandboxDailyHoursLimit ? `${server.sandboxDailyHoursLimit}h/day` : "Unlimited"}
                </span>
              )}
              {server.cryoSleepEnabled && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: server.status === "SLEEPING" ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.1)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}>
                  <Moon size={10} /> Cryo-Sleep ({server.cryoSleepIdleMinutes || 10}m)
                </span>
              )}
            </div>
          </div>
        </div>

        <StatusPill status={server.status} suspended={server.suspended} />
      </div>

      {/* IP Bar */}
      <div 
        onClick={copyIp}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "var(--bg-input)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "monospace",
          cursor: "pointer",
          color: "var(--text-secondary)"
        }}
      >
        <span>{address}</span>
        <span style={{ fontSize: 10.5, color: copied ? "#10b981" : "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, fontFamily: "sans-serif" }}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={11} /> Copy</>}
        </span>
      </div>

      {/* Resource Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: 10.5, fontWeight: 600 }}>RAM</div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatRam(server.ram)}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: 10.5, fontWeight: 600 }}>CPU</div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{server.cpu}%</div>
        </div>
        <div>
          <div style={{ color: "var(--text-dim)", fontSize: 10.5, fontWeight: 600 }}>STORAGE</div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {server.diskUsedMb !== undefined && server.diskUsedMb > 0
              ? `${server.diskUsedMb >= 1024 ? (server.diskUsedMb / 1024).toFixed(1) + "G" : server.diskUsedMb + "M"} / ${formatDisk(server.disk)}`
              : formatDisk(server.disk)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {server.suspended ? (
          <span className="status-pill" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
            Suspended
          </span>
        ) : (
          <PowerControls serverId={server.id} status={server.status} suspended={server.suspended} onActionComplete={onActionComplete} />
        )}
        
        <Link 
          href={`/servers/${server.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--text-secondary)",
            padding: "5px 8px"
          }}
          className="hover:text-white"
        >
          <span>Open</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
