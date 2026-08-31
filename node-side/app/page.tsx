"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Check, AlertTriangle, CheckCircle2, Cpu, MemoryStick, Activity, RefreshCw } from "lucide-react";

interface NodeStats {
  status: string;
  nodeId: string;
  agentVersion: string;
  configured: boolean;
  adminApiUrl: string;
  resources?: {
    cpuUsage: number;
    ramUsage: number;
    ramUsedMb: number;
    ramTotalMb: number;
    loadAvg: number[];
    uptime: number;
  };
  timestamp: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

import { copyToClipboard } from "@/lib/clipboard";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
      style={{ color: copied ? "#a3e635" : "#737373", backgroundColor: "rgba(255,255,255,0.05)" }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? "Copied!" : "Copy")}
    </button>
  );
}

export default function NodePage() {
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/agent/health?local=1")
      .then(r => r.json())
      .then(d => { if (d?.status) setStats(d); else setError(true); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const bg = "#0a0a0a";
  const surface = "#111111";
  const surface2 = "#161616";
  const border = "#1e1e1e";
  const accent = "#a3e635";
  const muted = "#737373";
  const dim = "#404040";
  const text = "#f5f5f5";

  const isConfigured = stats?.configured === true;
  const nodeId = stats?.nodeId ?? "not-configured";
  const adminUrl = stats?.adminApiUrl ?? "http://localhost:3000";

  const envContent = `NODE_TOKEN=<paste-token-from-admin-panel>
NODE_ID=<paste-node-id-from-admin-panel>
ADMIN_API_URL=${adminUrl}
AGENT_PORT=3001
HEARTBEAT_INTERVAL_SECONDS=30
SERVER_DATA_DIR=./server-data`;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: bg, minHeight: "100vh", color: text }}>
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Image src="/logo.png" alt="Flaxa Studios" width={36} height={36} style={{ borderRadius: "8px" }} />
            <div>
              <div style={{ fontWeight: "700", fontSize: "15px" }}>Rubber Panel — Node Agent</div>
              <div style={{ fontSize: "11px", color: muted }}>by Flaxa Studios · v1.0.0</div>
            </div>
          </div>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "12px", color: muted, background: surface, border: `1px solid ${border}`, borderRadius: "8px", padding: "0.4rem 0.75rem", cursor: "pointer" }}>
            <RefreshCw style={{ width: "12px", height: "12px" }} />
            Refresh
          </button>
        </div>

        {/* Configuration status banner */}
        {!loading && (
          <div style={{
            borderRadius: "12px",
            border: `1px solid ${isConfigured ? "rgba(163,230,53,0.25)" : "rgba(234,179,8,0.25)"}`,
            backgroundColor: isConfigured ? "rgba(163,230,53,0.05)" : "rgba(234,179,8,0.05)",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}>
            {isConfigured
              ? <CheckCircle2 style={{ width: "18px", height: "18px", color: accent, flexShrink: 0 }} />
              : <AlertTriangle style={{ width: "18px", height: "18px", color: "#eab308", flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: isConfigured ? accent : "#eab308" }}>
                {isConfigured ? "Node Configured & Running" : "Node Not Configured"}
              </div>
              <div style={{ fontSize: "12px", color: muted, marginTop: "2px" }}>
                {isConfigured
                  ? `Connected to admin at ${adminUrl}`
                  : "Follow the setup guide below to connect this node to your admin panel."}
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div style={{ borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: surface, padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "10px", color: dim, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
            Agent Status
          </div>
          {loading ? (
            <div style={{ color: muted, fontSize: "13px" }}>Connecting...</div>
          ) : stats ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {[
                { label: "Status", value: <span style={{ color: accent }}>● {stats.status}</span> },
                { label: "Version", value: stats.agentVersion },
                { label: "Node ID", value: <span style={{ fontFamily: "monospace", fontSize: "11px", color: isConfigured ? text : "#eab308" }}>{nodeId}</span> },
                { label: "Uptime", value: stats.resources ? formatUptime(stats.resources.uptime) : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: "11px", color: dim, marginBottom: "3px" }}>{label}</div>
                  <div style={{ fontSize: "13px" }}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#ef4444", fontSize: "13px" }}>⚠ Health endpoint error</div>
          )}
        </div>

        {/* Resources */}
        {stats?.resources && (
          <div style={{ borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: surface, padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ fontSize: "10px", color: dim, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
              System Resources
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              {[
                { label: "CPU", value: stats.resources.cpuUsage },
                { label: "RAM", value: stats.resources.ramUsage, sub: `${stats.resources.ramUsedMb}MB / ${stats.resources.ramTotalMb}MB` },
              ].map(({ label, value, sub }) => {
                const color = value > 85 ? "#ef4444" : value > 65 ? "#eab308" : accent;
                return (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "12px" }}>
                      <span style={{ color: muted }}>{label}</span>
                      <span style={{ fontFamily: "monospace", color: text }}>{value.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "5px", borderRadius: "3px", backgroundColor: "#2a2a2a", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, backgroundColor: color, borderRadius: "3px", transition: "width 0.5s" }} />
                    </div>
                    {sub && <div style={{ fontSize: "10px", color: dim, marginTop: "3px" }}>{sub}</div>}
                  </div>
                );
              })}
            </div>
            {stats.resources.loadAvg?.some(n => n > 0) && (
              <div style={{ marginTop: "0.75rem", fontSize: "11px", color: dim }}>
                Load avg: {stats.resources.loadAvg.map(n => n.toFixed(2)).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* ═══ SETUP GUIDE ═══ */}
        <div style={{ borderRadius: "12px", border: `1px solid ${border}`, backgroundColor: surface, overflow: "hidden", marginBottom: "1rem" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${border}`, backgroundColor: surface2 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: text }}>🔧 Node Setup Guide</div>
            <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>
              How to connect this node to your Rubber Panel admin
            </div>
          </div>

          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Step 1 */}
            <Step number={1} title="Add this node in the Admin Panel">
              <p style={{ fontSize: "12px", color: muted, margin: 0 }}>
                Go to <strong style={{ color: text }}>http://localhost:3000/nodes</strong> → click <strong style={{ color: accent }}>Add Node</strong>.<br />
                Fill in the details:
              </p>
              <div style={{ marginTop: "0.5rem", display: "grid", gap: "4px", fontSize: "12px" }}>
                {[
                  ["Name", "Local Dev Node (or any name)"],
                  ["FQDN / IP", "127.0.0.1 (or your VPS IP)"],
                  ["Agent Port", "3001"],
                  ["Location", "Optional — e.g. Mumbai"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: "0.5rem" }}>
                    <span style={{ color: dim, minWidth: "80px" }}>{k}</span>
                    <span style={{ color: text }}>{v}</span>
                  </div>
                ))}
              </div>
            </Step>

            {/* Step 2 */}
            <Step number={2} title="Copy the Node Token & ID">
              <p style={{ fontSize: "12px", color: muted, margin: 0 }}>
                After clicking Create Node, a <span style={{ color: "#eab308" }}>one-time token</span> will be shown. <strong style={{ color: text }}>Copy both the Token and Node ID now</strong> — the token is only shown once.
              </p>
            </Step>

            {/* Step 3 */}
            <Step number={3} title={`Edit node-side/.env`}>
              <p style={{ fontSize: "12px", color: muted, margin: "0 0 0.5rem 0" }}>
                Open <code style={{ color: accent, fontFamily: "monospace" }}>rubber-panel/node-side/.env</code> and update:
              </p>
              <div style={{ position: "relative", borderRadius: "8px", backgroundColor: "#0d0d0d", border: `1px solid ${border}`, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
                  <CopyButton text={envContent} label="Copy .env" />
                </div>
                <pre style={{ margin: 0, padding: "0.875rem 1rem", fontSize: "11px", fontFamily: "monospace", color: "#e2e8f0", lineHeight: 1.7, overflowX: "auto" }}>
{`NODE_TOKEN=`}<span style={{ color: "#eab308" }}>&lt;paste-token-from-admin&gt;</span>{`
NODE_ID=`}<span style={{ color: "#eab308" }}>&lt;paste-node-id-from-admin&gt;</span>{`
ADMIN_API_URL=http://localhost:3000
AGENT_PORT=3001
HEARTBEAT_INTERVAL_SECONDS=30
SERVER_DATA_DIR=./server-data`}
                </pre>
              </div>
            </Step>

            {/* Step 4 */}
            <Step number={4} title="Restart the node-side server">
              <p style={{ fontSize: "12px", color: muted, margin: "0 0 0.5rem 0" }}>
                Kill and restart the dev server. The node will begin sending heartbeats to the admin panel.
              </p>
              <div style={{ borderRadius: "8px", backgroundColor: "#0d0d0d", border: `1px solid ${border}`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1rem", borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: "11px", color: dim }}>terminal — rubber-panel/node-side</span>
                  <CopyButton text="npm run dev" />
                </div>
                <pre style={{ margin: 0, padding: "0.75rem 1rem", fontSize: "12px", fontFamily: "monospace", color: accent }}>npm run dev</pre>
              </div>
            </Step>

            {/* Step 5 */}
            <Step number={5} title="Verify in Admin Panel">
              <p style={{ fontSize: "12px", color: muted, margin: 0 }}>
                Return to <strong style={{ color: text }}>Nodes</strong> in the admin panel. Within ~30 seconds the node status should change from <span style={{ color: "#ef4444" }}>OFFLINE</span> to <span style={{ color: accent }}>ONLINE</span> once the heartbeat is received.
              </p>
            </Step>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#252525", marginTop: "1.5rem" }}>
          Rubber Panel v1.0.0 · Flaxa Studios · Node Agent on :{process.env.AGENT_PORT ?? "3001"}
        </p>
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "0.875rem" }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "rgba(163,230,53,0.15)", border: "1px solid rgba(163,230,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#a3e635", flexShrink: 0, marginTop: "1px" }}>
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#f5f5f5", marginBottom: "0.4rem" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
