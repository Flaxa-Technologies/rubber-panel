"use client";

import { useServer } from "@/components/server/ServerContext";
import { formatAllocation } from "@/lib/server-utils";
import { Network, Copy, Check, Plus, Trash2, Loader2, AlertTriangle, Sparkles, Globe, ExternalLink, ArrowRight, Radio, ShieldAlert, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { copyToClipboard } from "@/lib/clipboard";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";

interface QuotaData {
  remainingAllocations: number;
  maxAllocations: number;
  usedAllocations: number;
  isSuspended: boolean;
}

interface ServerSubdomain {
  id: string;
  subdomain: string;
  fqdn: string;
  targetHost: string;
  port: number;
  status: string;
}

export default function NetworkPage() {
  const { server, refreshServer } = useServer();
  const [copied, setCopied] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [subdomains, setSubdomains] = useState<ServerSubdomain[]>([]);
  const [subdomainLimit, setSubdomainLimit] = useState(1);
  const [canCreateSubdomain, setCanCreateSubdomain] = useState(false);
  const [loadingSubdomains, setLoadingSubdomains] = useState(true);

  async function loadQuota() {
    try {
      const res = await fetch("/api/user/resources");
      if (res.ok) {
        const data = await res.json();
        if (data.hasCustomQuota && data.quota) {
          setQuota(data.quota);
        }
      }
    } catch {
      // ignore
    }
  }

  async function loadSubdomains() {
    try {
      setLoadingSubdomains(true);
      const res = await fetch(`/api/user/servers/${server.id}/subdomains`);
      if (res.ok) {
        const data = await res.json();
        setSubdomains(data.subdomains || []);
        setSubdomainLimit(data.limit ?? 1);
        setCanCreateSubdomain(data.canCreate ?? false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSubdomains(false);
    }
  }

  useEffect(() => {
    loadQuota();
    loadSubdomains();
  }, [server.id]);

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleSetPrimary(allocId: string) {
    setSettingPrimaryId(allocId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/allocations/${allocId}/primary`, {
        method: "POST",
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server returned status ${res.status}` };
      }
      if (res.ok) {
        setSuccess(data.message || "Primary port updated successfully!");
        await refreshServer();
      } else {
        setError(data.error || "Failed to set primary port.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error while setting primary port.");
    }
    setSettingPrimaryId(null);
  }

  async function handleAllocatePort() {
    setAllocating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/allocations`, {
        method: "POST",
      });
      if (res.status === 401) {
        setError("Your session has expired. Please refresh the page or log in again.");
        setAllocating(false);
        return;
      }
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server returned status ${res.status}` };
      }
      if (res.ok) {
        setSuccess(data.message || "Port allocated successfully!");
        await Promise.all([refreshServer(), loadQuota()]);
      } else {
        setError(data.error || "Failed to allocate port.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error while allocating port.");
    }
    setAllocating(false);
  }

  async function handleReleasePort(allocId: string) {
    setReleasingId(allocId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/user/servers/${server.id}/allocations/${allocId}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        setError("Your session has expired. Please refresh the page or log in again.");
        setReleasingId(null);
        return;
      }
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server returned status ${res.status}` };
      }
      if (res.ok) {
        setSuccess(data.message || "Port released back to quota pool!");
        await Promise.all([refreshServer(), loadQuota()]);
      } else {
        setError(data.error || "Failed to release port.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error while releasing port.");
    }
    setReleasingId(null);
  }

  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const username = sessionUser?.username || sessionUser?.name || "user";
  const shortId = (server.uuid || server.id).replace(/-/g, "").slice(0, 8);
  const sftpHost = server.node?.fqdn || (server.node as any)?.ip || "127.0.0.1";
  const sftpPort = 2022;
  const sftpUsername = `${username}.${shortId}`;
  const sftpAddress = `sftp://${sftpUsername}@${sftpHost}:${sftpPort}`;
  const isSftpEnabled = (server as any).sftpEnabled !== false;

  const primary = server.allocations[0];
  const additional = server.allocations.slice(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, width: "100%" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-pure)" }}>
            Network &amp; Port Allocations
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Manage the primary connection and extra service ports (e.g. Votifier, Geyser Bedrock, Dynmap, RCON).
          </p>
        </div>

        {quota && quota.remainingAllocations > 0 && !quota.isSuspended && (
          <button
            onClick={handleAllocatePort}
            disabled={allocating}
            className="saas-btn saas-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 10 }}
          >
            {allocating ? <><Loader2 size={13} className="animate-spin" /> Allocating Port...</> : <><Plus size={14} /> Allocate Port from Quota ({quota.remainingAllocations} left)</>}
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ padding: 12, borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
          <Check size={15} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {/* SFTP Connection Details Card (Pterodactyl-Style) */}
      <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
              <FolderOpen size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                SFTP Remote File Transfer
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isSftpEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: isSftpEnabled ? "#10b981" : "#ef4444", border: `1px solid ${isSftpEnabled ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}` }}>
                  {isSftpEnabled ? "PORT 2022 ACTIVE" : "DISABLED"}
                </span>
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Connect using FileZilla, WinSCP, Cyberduck, or any SFTP client with your panel password
              </p>
            </div>
          </div>

          {isSftpEnabled && (
            <a
              href={sftpAddress}
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 6 }}
            >
              <ExternalLink size={13} />
              <span>Launch SFTP Client</span>
            </a>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, backgroundColor: "rgba(0, 0, 0, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Host / Server Address</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#ffffff" }}>{sftpHost}</span>
              <button onClick={() => { copyToClipboard(sftpHost); setCopied("sftp-host"); setTimeout(() => setCopied(null), 2000); }} className="btn btn-ghost" style={{ padding: 2 }}>
                {copied === "sftp-host" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>SFTP Port</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#ffffff" }}>2022</span>
              <button onClick={() => { copyToClipboard("2022"); setCopied("sftp-port"); setTimeout(() => setCopied(null), 2000); }} className="btn btn-ghost" style={{ padding: 2 }}>
                {copied === "sftp-port" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Username</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#ffffff" }}>{sftpUsername}</span>
              <button onClick={() => { copyToClipboard(sftpUsername); setCopied("sftp-user"); setTimeout(() => setCopied(null), 2000); }} className="btn btn-ghost" style={{ padding: 2 }}>
                {copied === "sftp-user" ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>Password</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontStyle: "italic" }}>
              Your Account Password
            </div>
          </div>
        </div>
      </div>

      {server.allocations.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No Allocations"
          description="No IP addresses or ports assigned to this instance."
        />
      ) : (
        <>
          {/* Primary Connection */}
          {primary && (
            <div className="saas-card" style={{ padding: "20px 24px", borderRadius: 16, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span className="dot-indicator dot-online" />
                    <span>Primary Game Connection</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "var(--text-pure)" }}>
                    {formatAllocation(primary)}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    Enter this address in your Minecraft client to connect to your server.
                  </p>
                </div>

                <button
                  onClick={() => copyAddress(formatAllocation(primary))}
                  className="btn-solid-white"
                  style={{ padding: "8px 16px", fontSize: 12, borderRadius: 10 }}
                >
                  {copied === formatAllocation(primary) ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Address</>}
                </button>
              </div>
            </div>
          )}

          {/* Additional Ports */}
          {additional.length > 0 && (
            <div className="saas-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, width: "100%" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Additional Ports &amp; Services ({additional.length})</span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Allocated from Quota Pool</span>
              </div>
              <div>
                {additional.map((alloc, i) => {
                  const address = formatAllocation(alloc);
                  const isReleasing = releasingId === alloc.id;

                  return (
                    <div
                      key={alloc.id || i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 20px",
                        borderBottom: i < additional.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      }}
                      className="hover:bg-white/[0.02]"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{address}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
                          PORT {alloc.port}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => copyAddress(address)}
                          className="btn-secondary-dark"
                          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {copied === address ? <Check size={13} /> : <Copy size={13} />}
                          <span>Copy</span>
                        </button>

                        <button
                          onClick={() => alloc.id && handleSetPrimary(alloc.id)}
                          disabled={settingPrimaryId === alloc.id || !alloc.id}
                          className="btn-secondary-dark"
                          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, color: "#38bdf8", display: "flex", alignItems: "center", gap: 4 }}
                          title="Set this port as the Primary Game Connection"
                        >
                          {settingPrimaryId === alloc.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                          <span>Make Primary</span>
                        </button>

                        <button
                          onClick={() => alloc.id && handleReleasePort(alloc.id)}
                          disabled={isReleasing || !alloc.id}
                          className="btn-secondary-dark"
                          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {isReleasing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          <span>Release</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Subdomains (Individual SRV Records) */}
          <div className="saas-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, width: "100%" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={16} className="text-sky-400" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Custom Minecraft Subdomains ({subdomains.length} / {subdomainLimit})
                </span>
              </div>
              <Link
                href="/subdomains"
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#38bdf8",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                className="hover:underline"
              >
                <span>Manage All Subdomains</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {loadingSubdomains ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                <Loader2 size={18} className="animate-spin" style={{ margin: "0 auto 6px" }} />
                <span>Checking SRV DNS bindings...</span>
              </div>
            ) : subdomains.length === 0 ? (
              <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-pure)" }}>
                    No custom subdomain bound to this server
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Connect a clean address like <strong>play.yourdomain.com</strong> without specifying port numbers.
                  </p>
                </div>
                <Link
                  href="/subdomains"
                  className="saas-btn saas-btn-primary"
                  style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, textDecoration: "none" }}
                >
                  + Add Custom Subdomain
                </Link>
              </div>
            ) : (
              <div>
                {subdomains.map((sub, idx) => {
                  const isCopied = copied === sub.fqdn;
                  return (
                    <div
                      key={sub.id || idx}
                      style={{
                        padding: "14px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        borderBottom: idx < subdomains.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      }}
                      className="hover:bg-white/[0.02]"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#38bdf8" }}>
                          {sub.fqdn}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#34d399" }}>
                          SRV ACTIVE
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => copyAddress(sub.fqdn)}
                          className="btn-secondary-dark"
                          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          <span>{isCopied ? "Copied" : "Copy Subdomain"}</span>
                        </button>
                        <Link
                          href="/subdomains"
                          className="btn-secondary-dark"
                          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8, textDecoration: "none", color: "var(--text-muted)" }}
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Radar Network Telemetry & Under Attack Mode */}
          <RadarSecurityWidget serverId={server.id} />
        </>
      )}
    </div>
  );
}

function RadarSecurityWidget({ serverId }: { serverId: string }) {
  const [radarData, setRadarData] = useState<{
    connsPerSec: number;
    statusBadge: "ALL_CLEAR" | "ELEVATED" | "UNDER_ATTACK";
    underAttackMode: boolean;
    underAttackExpiresAt: string | null;
    timeline: Array<{ timestamp: string; connsPerSec: number }>;
  } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [msg, setMsg] = useState("");

  async function fetchRadar() {
    try {
      const res = await fetch(`/api/user/servers/${serverId}/radar`);
      if (res.ok) {
        const d = await res.json();
        setRadarData(d);
      }
    } catch {}
  }

  useEffect(() => {
    fetchRadar();
    const intv = setInterval(fetchRadar, 3000);
    return () => clearInterval(intv);
  }, [serverId]);

  async function handleToggleUnderAttack() {
    if (!radarData) return;
    setToggling(true);
    setMsg("");
    try {
      const res = await fetch(`/api/user/servers/${serverId}/radar/under-attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: !radarData.underAttackMode,
          durationMinutes: 60,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(d.message || "Updated successfully");
        await fetchRadar();
      } else {
        setMsg(d.error || "Failed to toggle");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setToggling(false);
    }
  }

  const timeline = radarData?.timeline || [];
  const maxC = Math.max(5, ...timeline.map((t) => t.connsPerSec));
  const svgPoints = timeline.map((s, idx) => {
    const x = timeline.length <= 1 ? 0 : (idx / (timeline.length - 1)) * 400;
    const y = 60 - (s.connsPerSec / maxC) * 45 - 5;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="saas-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, width: "100%" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Radio size={16} className="text-lime-400" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Traffic Radar &amp; DDoS Shield
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              background:
                radarData?.statusBadge === "UNDER_ATTACK"
                  ? "rgba(239,68,68,0.15)"
                  : radarData?.statusBadge === "ELEVATED"
                  ? "rgba(245,158,11,0.15)"
                  : "rgba(16,185,129,0.15)",
              color:
                radarData?.statusBadge === "UNDER_ATTACK"
                  ? "#f87171"
                  : radarData?.statusBadge === "ELEVATED"
                  ? "#fbbf24"
                  : "#34d399",
            }}
          >
            {radarData?.statusBadge === "UNDER_ATTACK"
              ? "● UNDER ATTACK FILTERING"
              : radarData?.statusBadge === "ELEVATED"
              ? "● ELEVATED TRAFFIC"
              : "● ALL CLEAR"}
          </span>
        </div>
      </div>

      <div style={{ padding: "18px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Real-Time Connection Activity
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-pure)", marginTop: 2, fontFamily: "monospace" }}>
            {radarData?.connsPerSec || 0} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-dim)" }}>conns / sec</span>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.4 }}>
            In-kernel telemetry monitoring connection requests and socket handshakes on your allocated game port.
          </p>
        </div>

        {/* Mini sparkline */}
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 8, border: "1px solid var(--border-subtle)", height: 75, position: "relative" }}>
          {timeline.length > 1 ? (
            <svg viewBox="0 0 400 60" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <polyline
                fill="none"
                stroke={radarData?.statusBadge === "UNDER_ATTACK" ? "#f87171" : "#a3e635"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgPoints}
              />
            </svg>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, color: "var(--text-dim)" }}>
              Awaiting connection telemetry...
            </div>
          )}
        </div>

        {/* Under attack toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)" }}>
            Emergency Under Attack Mode
          </div>
          <button
            onClick={handleToggleUnderAttack}
            disabled={toggling}
            className={radarData?.underAttackMode ? "btn-solid-white" : "saas-btn saas-btn-primary"}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: radarData?.underAttackMode ? "rgba(239,68,68,0.9)" : undefined,
              color: radarData?.underAttackMode ? "#fff" : undefined,
            }}
          >
            {toggling ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
            <span>{radarData?.underAttackMode ? "Disable Under Attack Mode" : "Enable Under Attack Mode"}</span>
          </button>
          <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
            {radarData?.underAttackMode && radarData?.underAttackExpiresAt
              ? `Auto-reverts at ${new Date(radarData.underAttackExpiresAt).toLocaleTimeString()}`
              : "Applies aggressive rate limits to your port for 1 hr."}
          </span>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "8px 20px", fontSize: 11, background: "rgba(56,189,248,0.08)", color: "#38bdf8", borderTop: "1px solid var(--border-subtle)" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

