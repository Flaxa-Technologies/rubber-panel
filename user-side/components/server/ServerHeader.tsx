"use client";

import { useState } from "react";
import type { UserServer } from "@/lib/types";
import PowerControls from "./PowerControls";
import { ArrowLeft, Copy, Check, Globe, Shield, Moon } from "lucide-react";
import Link from "next/link";
import { getServerAddress } from "@/lib/server-utils";
import { copyToClipboard } from "@/lib/clipboard";
import { StatusPill } from "./ServerCard";

interface ServerHeaderProps {
  server: UserServer;
  onActionComplete?: () => void;
  onOptimisticStatus?: (newStatus: string) => void;
}

export default function ServerHeader({ server, onActionComplete, onOptimisticStatus }: ServerHeaderProps) {
  const fullAddress = getServerAddress(server);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!fullAddress || fullAddress === "—") return;
    await copyToClipboard(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4 }} className="hover:text-white">
          <ArrowLeft size={13} /> Instances
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{server.name}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
            {server.name}
          </h1>
          <StatusPill status={server.status} suspended={server.suspended} />

          {/* Connection Address Badge with 1-Click Copy */}
          <button
            type="button"
            onClick={handleCopy}
            title="Click to copy server IP / address"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: "monospace",
              padding: "3px 10px",
              borderRadius: 8,
              background: copied ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)",
              color: copied ? "#38bdf8" : "var(--text-secondary)",
              border: copied ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Globe size={11} style={{ color: copied ? "#38bdf8" : "var(--text-muted)" }} />
            <span>{fullAddress}</span>
            {copied ? <Check size={11} style={{ color: "#38bdf8" }} /> : <Copy size={11} style={{ color: "var(--text-muted)" }} />}
          </button>
          
          {server.serverType === "NODEJS" || server.software?.type === "NODEJS" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(34, 197, 94, 0.12)",
                color: "#4ade80",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                fontFamily: "monospace",
              }}>
                Node.js v{server.nodeVersion || "20"}
              </span>
              {server.securityProtection !== false && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "rgba(56, 189, 248, 0.12)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}>
                  <Shield size={12} /> Shield Active
                </span>
              )}
            </div>
          ) : server.serverType === "PYTHON" ? (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: "rgba(163, 230, 53, 0.12)",
              color: "#a3e635",
              border: "1px solid rgba(163, 230, 53, 0.25)",
              fontFamily: "monospace",
            }}>
              Python Runtime
            </span>
          ) : server.serverType === "RUST" ? (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: "rgba(249, 115, 22, 0.12)",
              color: "#fb923c",
              border: "1px solid rgba(249, 115, 22, 0.25)",
              fontFamily: "monospace",
            }}>
              Rust Service
            </span>
          ) : server.serverType === "DATABASE" ? (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: "rgba(59, 130, 246, 0.12)",
              color: "#60a5fa",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              fontFamily: "monospace",
            }}>
              Database
            </span>
          ) : server.serverType === "CUSTOM" ? (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: "rgba(168, 85, 247, 0.12)",
              color: "#c084fc",
              border: "1px solid rgba(168, 85, 247, 0.25)",
              fontFamily: "monospace",
            }}>
              Custom Container
            </span>
          ) : (
            server.javaVersion && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(245, 158, 11, 0.12)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                fontFamily: "monospace",
              }}>
                Java {server.javaVersion}
              </span>
            )
          )}

          {/* Cryo-Sleep Status Badge */}
          {server.cryoSleepEnabled ? (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 6,
              background: server.status === "SLEEPING" ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.1)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title={`Cryo-Sleep is Active: Server will suspend to 0% RAM after ${server.cryoSleepIdleMinutes || 10} minutes of inactivity.`}>
              <Moon size={12} /> Cryo-Sleep: Enabled ({server.cryoSleepIdleMinutes || 10}m)
            </span>
          ) : (
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.04)",
              color: "var(--text-dim)",
              border: "1px solid var(--border-subtle)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Cryo-Sleep is Disabled for this instance.">
              <Moon size={12} /> Cryo-Sleep: Disabled
            </span>
          )}
        </div>

        <PowerControls
          serverId={server.id}
          status={server.status}
          suspended={server.suspended}
          onActionComplete={onActionComplete}
          onOptimisticStatus={onOptimisticStatus}
        />
      </div>
    </div>
  );
}
