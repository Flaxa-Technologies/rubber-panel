"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  Copy,
  Check,
  Trash2,
  Server,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Info,
} from "lucide-react";

interface SubdomainItem {
  id: string;
  domainId: string;
  serverId: string;
  userId: string;
  subdomain: string;
  fqdn: string;
  targetHost: string;
  port: number;
  status: string;
  createdAt: string;
  domain: {
    id: string;
    name: string;
    provider: string;
    status: string;
  };
  server?: {
    id: string;
    name: string;
    node?: {
      id: string;
      name: string;
      fqdn: string;
    };
    allocations?: Array<{ ip: string; port: number }>;
  };
}

interface ServerLimit {
  serverId: string;
  serverName: string;
  limit: number;
  used: number;
  canCreate: boolean;
}

interface AvailableDomain {
  id: string;
  name: string;
  description: string | null;
  provider: string;
}

export default function UserSubdomainsPage() {
  const [subdomains, setSubdomains] = useState<SubdomainItem[]>([]);
  const [serverLimits, setServerLimits] = useState<ServerLimit[]>([]);
  const [availableDomains, setAvailableDomains] = useState<AvailableDomain[]>([]);
  const [allowSubdomains, setAllowSubdomains] = useState(true);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [subdomainPrefix, setSubdomainPrefix] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Deletion modal state
  const [deletingSubdomain, setDeletingSubdomain] = useState<SubdomainItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [subRes, domRes] = await Promise.all([
        fetch("/api/user/subdomains"),
        fetch("/api/user/subdomains/available-domains"),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubdomains(subData.subdomains || []);
        setServerLimits(subData.serverLimits || []);
        setAllowSubdomains(subData.allowSubdomains !== false);
      }

      if (domRes.ok) {
        const domData = await domRes.json();
        setAvailableDomains(domData.domains || []);
      }
    } catch (err) {
      console.error("Failed to load subdomains:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCopy(address: string) {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 1500);
  }

  const eligibleServers = serverLimits.filter((s) => s.canCreate);

  function openCreateModal() {
    setErrorMsg("");
    setSuccessMsg("");
    setSubdomainPrefix("");
    if (eligibleServers.length > 0) {
      setSelectedServerId(eligibleServers[0].serverId);
    }
    if (availableDomains.length > 0) {
      setSelectedDomainId(availableDomains[0].id);
    }
    setShowCreateModal(true);
  }

  async function handleCreateSubdomain(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/user/subdomains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId: selectedDomainId,
          serverId: selectedServerId,
          subdomain: subdomainPrefix.trim().toLowerCase(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || "Custom domain created successfully!");
        setShowCreateModal(false);
        await loadData();
      } else {
        setErrorMsg(data.error || "Failed to create subdomain.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Network error occurred.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSubdomain() {
    if (!deletingSubdomain) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/subdomains/${deletingSubdomain.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeletingSubdomain(null);
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete subdomain.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  const selectedDomainObj = availableDomains.find((d) => d.id === selectedDomainId);
  const previewFqdn = subdomainPrefix ? `${subdomainPrefix.trim().toLowerCase()}.${selectedDomainObj?.name || "example.com"}` : `play.${selectedDomainObj?.name || "example.com"}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-pure)" }}>
              Custom Subdomains
            </h1>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(56,189,248,0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(56,189,248,0.25)",
              }}
            >
              Minecraft SRV Engine
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
            Connect clean, easy-to-remember domain names to your Minecraft servers without exposing port numbers.
          </p>
        </div>

        {allowSubdomains && availableDomains.length > 0 && eligibleServers.length > 0 && (
          <button
            onClick={openCreateModal}
            className="saas-btn saas-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 10 }}
          >
            <Plus size={14} />
            <span>Create Custom Subdomain</span>
          </button>
        )}
      </div>

      {!allowSubdomains && (
        <div style={{ padding: 14, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13, background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>Custom subdomains are currently disabled by system administrators.</span>
        </div>
      )}

      {/* Quotas & Allocations Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="saas-card" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Active Subdomains</span>
            <Globe size={14} className="text-sky-400" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-pure)", marginTop: 6 }}>
            {subdomains.length}
          </div>
          <div style={{ fontSize: 11.5, color: "#38bdf8", marginTop: 2 }}>
            Zero-port Minecraft SRV records
          </div>
        </div>

        <div className="saas-card" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Available Root Domains</span>
            <Sparkles size={14} className="text-emerald-400" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-pure)", marginTop: 6 }}>
            {availableDomains.length}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
            Cloudflare DNS verified domains
          </div>
        </div>

        <div className="saas-card" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Eligible Minecraft Servers</span>
            <Server size={14} className="text-indigo-400" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-pure)", marginTop: 6 }}>
            {eligibleServers.length} / {serverLimits.length}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
            Servers with remaining quota
          </div>
        </div>
      </div>

      {/* Active Subdomains Table / Cards */}
      <div className="saas-card" style={{ padding: 0, overflow: "hidden", borderRadius: 16, width: "100%" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Your Registered Custom Subdomains ({subdomains.length})</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <Info size={12} />
            <span>Players join using this exact address in Minecraft client</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
            <span style={{ fontSize: 12 }}>Loading custom domain allocations...</span>
          </div>
        ) : subdomains.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#38bdf8" }}>
              <Globe size={22} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-pure)", marginBottom: 4 }}>
              No Custom Subdomains Configured
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", maxWidth: 420, margin: "0 auto 16px" }}>
              Create a custom address like <strong>play.example.com</strong> so your players can join your server directly without remembering ports.
            </p>
            {allowSubdomains && availableDomains.length > 0 && eligibleServers.length > 0 && (
              <button
                onClick={openCreateModal}
                className="saas-btn saas-btn-primary"
                style={{ fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 10 }}
              >
                + Connect Your First Subdomain
              </button>
            )}
          </div>
        ) : (
          <div>
            {subdomains.map((sub, index) => {
              const isCopied = copiedAddress === sub.fqdn;
              return (
                <div
                  key={sub.id}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                    borderBottom: index < subdomains.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(56,189,248,0.1)",
                        color: "#38bdf8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Globe size={18} />
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "#38bdf8" }}>
                          {sub.fqdn}
                        </span>
                        <button
                          onClick={() => handleCopy(sub.fqdn)}
                          style={{
                            padding: "3px 8px",
                            fontSize: 11,
                            borderRadius: 6,
                            background: isCopied ? "rgba(16,185,129,0.2)" : "var(--bg-surface-elevated)",
                            color: isCopied ? "#34d399" : "var(--text-secondary)",
                            border: "1px solid var(--border-subtle)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {isCopied ? <Check size={11} /> : <Copy size={11} />}
                          <span>{isCopied ? "Copied" : "Copy IP"}</span>
                        </button>
                      </div>

                      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>Target: {sub.targetHost}:{sub.port}</span>
                        <span>•</span>
                        <span style={{ color: "#10b981", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <CheckCircle2 size={11} /> SRV Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {sub.server && (
                      <Link
                        href={`/servers/${sub.server.id}/network`}
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          textDecoration: "none",
                        }}
                        className="hover:text-white"
                      >
                        <Server size={13} className="text-zinc-500" />
                        <span>{sub.server.name}</span>
                        <ArrowRight size={11} style={{ opacity: 0.5 }} />
                      </Link>
                    )}

                    <button
                      onClick={() => setDeletingSubdomain(sub)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 11.5,
                        borderRadius: 8,
                        background: "transparent",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.2)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      className="hover:bg-red-500/10"
                    >
                      <Trash2 size={12} />
                      <span>Release</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 20,
              padding: 0,
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={18} className="text-sky-400" />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-pure)" }}>
                  Create Custom Minecraft Subdomain
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubdomain} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {errorMsg && (
                <div style={{ padding: 12, borderRadius: 10, fontSize: 12, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Server selection */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Target Minecraft Server
                </label>
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 12.5,
                    background: "var(--bg-surface-elevated)",
                    color: "var(--text-pure)",
                    border: "1px solid var(--border-medium)",
                    outline: "none",
                  }}
                >
                  {eligibleServers.map((s) => (
                    <option key={s.serverId} value={s.serverId}>
                      {s.serverName} ({s.used} / {s.limit} domains used)
                    </option>
                  ))}
                </select>
              </div>

              {/* Subdomain and Root Domain selection */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Subdomain Address
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    required
                    value={subdomainPrefix}
                    onChange={(e) => setSubdomainPrefix(e.target.value)}
                    placeholder="play, survival, pvp"
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontFamily: "monospace",
                      background: "var(--bg-surface-elevated)",
                      color: "var(--text-pure)",
                      border: "1px solid var(--border-medium)",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-muted)" }}>.</span>
                  <select
                    value={selectedDomainId}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    required
                    style={{
                      flex: 1.2,
                      padding: "9px 12px",
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontFamily: "monospace",
                      background: "var(--bg-surface-elevated)",
                      color: "var(--text-pure)",
                      border: "1px solid var(--border-medium)",
                      outline: "none",
                    }}
                  >
                    {availableDomains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  Use 3-32 alphanumeric characters and hyphens. Reserved words like <code>admin</code> or <code>api</code> are forbidden.
                </p>
              </div>

              {/* Live Preview */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(56,189,248,0.06)",
                  border: "1px solid rgba(56,189,248,0.18)",
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Connection Address Preview
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: "var(--text-pure)" }}>
                  {previewFqdn}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Individual Minecraft SRV record automatically created and routed via Cloudflare DNS.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary-dark"
                  style={{ padding: "8px 16px", fontSize: 12, borderRadius: 10 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !subdomainPrefix.trim()}
                  className="saas-btn saas-btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 18px", borderRadius: 10 }}
                >
                  {creating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Provisioning SRV Record...</span>
                    </>
                  ) : (
                    <span>Register Subdomain</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSubdomain && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="saas-card"
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 18,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#f87171" }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
                Release Subdomain {deletingSubdomain.fqdn}?
              </h3>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Are you sure you want to release <strong>{deletingSubdomain.fqdn}</strong>? The SRV DNS record in Cloudflare will be removed immediately and players will no longer be able to join using this name.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setDeletingSubdomain(null)}
                className="btn-secondary-dark"
                style={{ padding: "8px 16px", fontSize: 12, borderRadius: 10 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubdomain}
                disabled={deleting}
                style={{
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 10,
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {deleting ? "Releasing DNS..." : "Yes, Release Subdomain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
