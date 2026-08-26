"use client";

import { useServer } from "@/components/server/ServerContext";
import { formatAllocation } from "@/lib/server-utils";
import { Network, Copy, Check, Plus, Trash2, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import EmptyState from "@/components/ui/EmptyState";

interface QuotaData {
  remainingAllocations: number;
  maxAllocations: number;
  usedAllocations: number;
  isSuspended: boolean;
}

export default function NetworkPage() {
  const { server, refreshServer } = useServer();
  const [copied, setCopied] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  useEffect(() => {
    loadQuota();
  }, []);

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 1500);
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
        </>
      )}
    </div>
  );
}
