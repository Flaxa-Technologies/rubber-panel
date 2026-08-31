"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Edit2,
  ExternalLink,
  Shield,
  Server,
  Layers,
  Copy,
  Check,
  Loader2,
  Settings,
  HelpCircle,
  Link as LinkIcon,
  Sparkles,
  Zap,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface Domain {
  id: string;
  name: string;
  provider: string;
  apiTokenMasked: string;
  zoneId: string;
  status: "ACTIVE" | "PENDING" | "ERROR" | "DISABLED";
  isVerified: boolean;
  lastVerifiedAt: string | null;
  lastSyncError: string | null;
  description: string | null;
  subdomainsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Subdomain {
  id: string;
  domainId: string;
  serverId: string;
  userId: string;
  subdomain: string;
  fqdn: string;
  srvRecordId: string | null;
  targetRecordId: string | null;
  targetHost: string;
  port: number;
  status: "ACTIVE" | "PENDING" | "ERROR" | "ORPHANED";
  lastError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  domain: {
    id: string;
    name: string;
    provider: string;
    isVerified: boolean;
    status: string;
  };
  server?: {
    id: string;
    name: string;
    serverType: string;
    node?: {
      id: string;
      name: string;
      fqdn: string;
      location: string | null;
    };
    allocations?: Array<{ ip: string; port: number }>;
  };
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export default function SubdomainsAdminPage() {
  const [activeTab, setActiveTab] = useState<"subdomains" | "domains" | "settings">("subdomains");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedFqdn, setCopiedFqdn] = useState<string | null>(null);

  // Modals state
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [showEditDomainModal, setShowEditDomainModal] = useState<Domain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<Domain | null>(null);
  const [deletingSubdomain, setDeletingSubdomain] = useState<Subdomain | null>(null);

  // Form states
  const [domainName, setDomainName] = useState("");
  const [domainApiToken, setDomainApiToken] = useState("");
  const [domainZoneId, setDomainZoneId] = useState("");
  const [domainDescription, setDomainDescription] = useState("");
  const [submittingDomain, setSubmittingDomain] = useState(false);
  const [modalError, setModalError] = useState("");

  // Syncing/Verifying states
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [syncingSubdomainId, setSyncingSubdomainId] = useState<string | null>(null);

  // Settings tab state
  const [defaultPerServer, setDefaultPerServer] = useState("1");
  const [allowSubdomains, setAllowSubdomains] = useState(true);
  const [reservedPrefixes, setReservedPrefixes] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [domainsRes, subdomainsRes, settingsRes] = await Promise.all([
        fetch("/api/admin/domains"),
        fetch("/api/admin/domains/subdomains"),
        fetch("/api/admin/settings"),
      ]);

      if (domainsRes.ok) {
        const dData = await domainsRes.json();
        setDomains(dData.domains || []);
      }
      if (subdomainsRes.ok) {
        const sData = await subdomainsRes.json();
        setSubdomains(sData.subdomains || []);
      }
      if (settingsRes.ok) {
        const setJson = await settingsRes.json();
        const s = setJson.settings || {};
        setDefaultPerServer(s["domains.defaultPerServer"] ?? "1");
        setAllowSubdomains(s["domains.allowSubdomains"] !== "false");
        setReservedPrefixes(
          s["domains.reservedPrefixes"] ??
            '["admin","panel","node","api","mail","smtp","ftp","ssh","ns1","ns2","www","dev","status"]'
        );
      }
    } catch (err) {
      console.error("Failed to load domain data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCopy(text: string) {
    await copyToClipboard(text);
    setCopiedFqdn(text);
    setTimeout(() => setCopiedFqdn(null), 1500);
  }

  async function handleCreateDomain(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingDomain(true);
    setModalError("");

    try {
      const res = await fetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: domainName,
          apiToken: domainApiToken,
          zoneId: domainZoneId || undefined,
          description: domainDescription || undefined,
          provider: "CLOUDFLARE",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowAddDomainModal(false);
        setDomainName("");
        setDomainApiToken("");
        setDomainZoneId("");
        setDomainDescription("");
        await loadData();
      } else {
        setModalError(data.error || "Failed to create domain");
      }
    } catch (err: any) {
      setModalError(err?.message || "Network error");
    } finally {
      setSubmittingDomain(false);
    }
  }

  async function handleVerifyDomain(domainId: string) {
    setVerifyingDomainId(domainId);
    try {
      const res = await fetch(`/api/admin/domains/${domainId}/verify`, { method: "POST" });
      if (res.ok) {
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Domain verification failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingDomainId(null);
    }
  }

  async function handleDeleteDomain() {
    if (!deletingDomain) return;
    try {
      const res = await fetch(`/api/admin/domains/${deletingDomain.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingDomain(null);
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete domain");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteSubdomain() {
    if (!deletingSubdomain) return;
    try {
      const res = await fetch(`/api/admin/domains/subdomains/${deletingSubdomain.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingSubdomain(null);
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete subdomain");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSyncSubdomain(subId: string) {
    setSyncingSubdomainId(subId);
    try {
      const res = await fetch(`/api/admin/domains/subdomains/${subId}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await loadData();
      } else {
        alert(data.error || "Sync failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingSubdomainId(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            "domains.defaultPerServer": defaultPerServer,
            "domains.allowSubdomains": allowSubdomains ? "true" : "false",
            "domains.reservedPrefixes": reservedPrefixes,
          },
        }),
      });

      if (res.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      } else {
        const d = await res.json();
        alert(d.error || "Failed to save settings");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  }

  const filteredSubdomains = subdomains.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.fqdn.toLowerCase().includes(q) ||
      s.subdomain.toLowerCase().includes(q) ||
      (s.server?.name && s.server.name.toLowerCase().includes(q)) ||
      (s.user?.username && s.user.username.toLowerCase().includes(q)) ||
      (s.user?.email && s.user.email.toLowerCase().includes(q))
    );
  });

  const verifiedDomainsCount = domains.filter((d) => d.isVerified).length;
  const activeSubdomainsCount = subdomains.filter((s) => s.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-rp-text)" }}>
              Subdomain Management
            </h1>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
            >
              Minecraft SRV Records
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Dynamically provision and manage individual DNS SRV records for Minecraft servers via Cloudflare DNS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-lg transition-colors border"
            style={{
              backgroundColor: "var(--color-rp-surface-2)",
              borderColor: "var(--color-rp-border)",
              color: "var(--color-rp-text-muted)",
            }}
            title="Refresh All Records"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => {
              setModalError("");
              setShowAddDomainModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all"
            style={{
              backgroundColor: "var(--color-rp-accent)",
              color: "#000000",
            }}
          >
            <Plus size={14} />
            <span>Connect Root Domain</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Connected Domains
            </span>
            <Globe size={16} className="text-sky-400" />
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>
            {domains.length}
          </div>
          <div className="text-xs mt-1 text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>{verifiedDomainsCount} verified on Cloudflare</span>
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Active Subdomains
            </span>
            <Layers size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>
            {subdomains.length}
          </div>
          <div className="text-xs mt-1 text-sky-400 flex items-center gap-1">
            <Zap size={12} />
            <span>{activeSubdomainsCount} SRV records live</span>
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Default Quota / Server
            </span>
            <Shield size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--color-rp-text)" }}>
            {defaultPerServer === "0" ? "Disabled" : `${defaultPerServer} Domain${defaultPerServer === "1" ? "" : "s"}`}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
            Per-server overrides enabled
          </div>
        </div>

        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              DNS Architecture
            </span>
            <Sparkles size={16} className="text-emerald-400" />
          </div>
          <div className="text-sm font-bold mt-2 text-emerald-400 font-mono">
            INDIVIDUAL SRV
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
            Zero-wildcard, pure SRV routing
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-2 border-b"
        style={{ borderColor: "var(--color-rp-border)" }}
      >
        <button
          onClick={() => setActiveTab("subdomains")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "subdomains"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers size={14} />
          <span>Active Subdomains ({subdomains.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("domains")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "domains"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Globe size={14} />
          <span>Root Domains ({domains.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "settings"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Settings size={14} />
          <span>Global Settings &amp; Quotas</span>
        </button>
      </div>

      {/* Tab Content: Subdomains List */}
      {activeTab === "subdomains" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-rp-text-dim)" }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subdomain, server name, user..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs border outline-none transition-colors"
                style={{
                  backgroundColor: "var(--color-rp-surface)",
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text)",
                }}
              />
            </div>
          </div>

          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: "var(--color-rp-surface-2)",
                      borderColor: "var(--color-rp-border)",
                      color: "var(--color-rp-text-dim)",
                    }}
                  >
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Subdomain &amp; Connection</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Assigned Server</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Target Node &amp; Port</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Owner</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Cloudflare SRV</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                  {filteredSubdomains.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Globe size={32} className="opacity-30" />
                          <p className="text-sm font-medium">No custom subdomains found</p>
                          <p className="text-xs text-zinc-500">
                            Users can create custom Minecraft SRV subdomains in the User Panel.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSubdomains.map((sub) => {
                      const isSyncing = syncingSubdomainId === sub.id;
                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-white/[0.02] transition-colors"
                          style={{ color: "var(--color-rp-text)" }}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-sky-300">
                                {sub.fqdn}
                              </span>
                              <button
                                onClick={() => handleCopy(sub.fqdn)}
                                className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                title="Copy connection address"
                              >
                                {copiedFqdn === sub.fqdn ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>
                              _minecraft._tcp.{sub.fqdn}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {sub.server ? (
                              <div>
                                <div className="font-medium">{sub.server.name}</div>
                                <div className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                                  ID: {sub.server.id.substring(0, 8)}...
                                </div>
                              </div>
                            ) : (
                              <span className="text-red-400 text-xs">Orphaned (Server Deleted)</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-mono text-xs">
                              {sub.targetHost}:{sub.port}
                            </div>
                            <div className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                              Node: {sub.server?.node?.name ?? "Unknown"} ({sub.server?.node?.fqdn ?? "—"})
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {sub.user ? (
                              <div>
                                <div className="font-medium">{sub.user.username}</div>
                                <div className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                                  {sub.user.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              {sub.status === "ACTIVE" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 size={10} /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <AlertTriangle size={10} /> {sub.status}
                                </span>
                              )}
                            </div>
                            {sub.srvRecordId && (
                              <div className="text-[10px] font-mono mt-0.5 text-zinc-500">
                                CF ID: {sub.srvRecordId.substring(0, 8)}...
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSyncSubdomain(sub.id)}
                                disabled={isSyncing}
                                className="p-1.5 rounded-lg border hover:bg-white/10 transition-colors"
                                style={{
                                  borderColor: "var(--color-rp-border)",
                                  color: "var(--color-rp-text-muted)",
                                }}
                                title="Force Sync & Live DNS Test"
                              >
                                <RefreshCw size={13} className={isSyncing ? "animate-spin text-sky-400" : ""} />
                              </button>

                              <button
                                onClick={() => setDeletingSubdomain(sub)}
                                className="p-1.5 rounded-lg border hover:bg-red-500/10 hover:border-red-500/30 text-red-400 transition-colors"
                                style={{ borderColor: "var(--color-rp-border)" }}
                                title="Revoke and Purge SRV Record"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Root Domains List */}
      {activeTab === "domains" && (
        <div className="space-y-4">
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: "var(--color-rp-surface-2)",
                      borderColor: "var(--color-rp-border)",
                      color: "var(--color-rp-text-dim)",
                    }}
                  >
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Root Domain</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Zone ID</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">API Token</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Verification Status</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Subdomains</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                  {domains.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Globe size={32} className="opacity-30" />
                          <p className="text-sm font-medium">No root domains connected yet</p>
                          <button
                            onClick={() => setShowAddDomainModal(true)}
                            className="mt-2 text-xs font-semibold text-sky-400 hover:underline"
                          >
                            + Connect your first Cloudflare domain
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    domains.map((dom) => {
                      const isVerifying = verifyingDomainId === dom.id;
                      return (
                        <tr
                          key={dom.id}
                          className="hover:bg-white/[0.02] transition-colors"
                          style={{ color: "var(--color-rp-text)" }}
                        >
                          <td className="px-4 py-3.5 font-bold text-sm">
                            <div className="flex items-center gap-2">
                              <Globe size={15} className="text-sky-400" />
                              <span>{dom.name}</span>
                            </div>
                            {dom.description && (
                              <div className="text-[11px] font-normal mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>
                                {dom.description}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              CLOUDFLARE
                            </span>
                          </td>

                          <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
                            {dom.zoneId || <span className="text-zinc-600">Auto-detected</span>}
                          </td>

                          <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-400">
                            {dom.apiTokenMasked}
                          </td>

                          <td className="px-4 py-3.5">
                            {dom.isVerified ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                                <CheckCircle2 size={13} />
                                <span>Verified Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                                <AlertTriangle size={13} />
                                <span>Pending / Error</span>
                              </div>
                            )}
                            {dom.lastSyncError && (
                              <div className="text-[10px] text-red-400 max-w-xs truncate" title={dom.lastSyncError}>
                                {dom.lastSyncError}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-xs text-sky-400">{dom.subdomainsCount}</span>
                            <span className="text-[11px] text-zinc-500"> active</span>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleVerifyDomain(dom.id)}
                                disabled={isVerifying}
                                className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/10 transition-colors flex items-center gap-1.5"
                                style={{
                                  borderColor: "var(--color-rp-border)",
                                  color: "var(--color-rp-text)",
                                }}
                                title="Re-verify Cloudflare credentials and Zone status"
                              >
                                <RefreshCw size={12} className={isVerifying ? "animate-spin text-sky-400" : ""} />
                                <span>Verify</span>
                              </button>

                              <button
                                onClick={() => setDeletingDomain(dom)}
                                className="p-1.5 rounded-lg border hover:bg-red-500/10 hover:border-red-500/30 text-red-400 transition-colors"
                                style={{ borderColor: "var(--color-rp-border)" }}
                                title="Delete Domain and Purge All DNS Records"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Global Settings */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
          <div
            className="p-6 rounded-xl border space-y-6"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--color-rp-text)" }}>
                Custom Subdomain Policies
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                Control how users can bind subdomains to their servers.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/5">
              <div>
                <label className="text-xs font-semibold block" style={{ color: "var(--color-rp-text)" }}>
                  Allow Custom Subdomains Globally
                </label>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>
                  Toggle whether regular users are allowed to self-provision custom subdomains for their servers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={allowSubdomains}
                onChange={(e) => setAllowSubdomains(e.target.checked)}
                className="w-4 h-4 rounded accent-sky-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                Default Subdomains Allowed Per Server
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={defaultPerServer}
                onChange={(e) => setDefaultPerServer(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 rounded-lg text-xs border outline-none"
                style={{
                  backgroundColor: "var(--color-rp-surface-2)",
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text)",
                }}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                Set to <strong>1</strong> for standard single custom address per server. Set to <strong>0</strong> to require manual per-server limit approval by an administrator.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                Reserved Subdomain Prefixes (JSON Array)
              </label>
              <textarea
                rows={3}
                value={reservedPrefixes}
                onChange={(e) => setReservedPrefixes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono border outline-none"
                style={{
                  backgroundColor: "var(--color-rp-surface-2)",
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text)",
                }}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                List prefixes that cannot be claimed by regular users (e.g. <code>admin</code>, <code>panel</code>, <code>api</code>).
              </p>
            </div>

            {settingsSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} />
                <span>Subdomain settings successfully updated.</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  backgroundColor: "var(--color-rp-accent)",
                  color: "#000000",
                }}
              >
                {savingSettings ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Connect Domain Modal */}
      {showAddDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: "var(--color-rp-surface)",
              borderColor: "var(--color-rp-border)",
            }}
          >
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{ borderColor: "var(--color-rp-border)" }}
            >
              <div className="flex items-center gap-2.5">
                <Globe size={18} className="text-sky-400" />
                <h3 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                  Connect Root Domain (Cloudflare DNS)
                </h3>
              </div>
              <button
                onClick={() => setShowAddDomainModal(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDomain} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Root Domain Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  placeholder="e.g. mcplay.net or flaxa.host"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                  Do not include <code>http://</code> or subdomains. Just the apex domain.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Cloudflare API Token <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={domainApiToken}
                  onChange={(e) => setDomainApiToken(e.target.value)}
                  placeholder="e.g. vF8...9xK"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                  Token needs <code>Zone:DNS:Edit</code> &amp; <code>Zone:Zone:Read</code> permissions in Cloudflare.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Cloudflare Zone ID <span className="text-zinc-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={domainZoneId}
                  onChange={(e) => setDomainZoneId(e.target.value)}
                  placeholder="Leave blank to auto-detect by domain name"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--color-rp-text)" }}>
                  Description / Label <span className="text-zinc-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={domainDescription}
                  onChange={(e) => setDomainDescription(e.target.value)}
                  placeholder="e.g. Official Community Domain Pool"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDomainModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5 transition-colors"
                  style={{
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text-muted)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDomain}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: "var(--color-rp-accent)",
                    color: "#000000",
                  }}
                >
                  {submittingDomain ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Verifying with Cloudflare...</span>
                    </>
                  ) : (
                    <span>Connect &amp; Verify</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Domain Confirmation */}
      {deletingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--color-rp-surface)",
              borderColor: "var(--color-rp-border)",
            }}
          >
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h3 className="text-base font-semibold" style={{ color: "var(--color-rp-text)" }}>
                Delete Domain {deletingDomain.name}?
              </h3>
            </div>

            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
              Are you sure you want to completely disconnect <strong>{deletingDomain.name}</strong>?
              This will automatically revoke and purge <strong>{deletingDomain.subdomainsCount}</strong> live Minecraft SRV records from Cloudflare DNS!
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingDomain(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5 transition-colors"
                style={{
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text-muted)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDomain}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all"
              >
                Yes, Disconnect &amp; Purge DNS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subdomain Confirmation */}
      {deletingSubdomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--color-rp-surface)",
              borderColor: "var(--color-rp-border)",
            }}
          >
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h3 className="text-base font-semibold" style={{ color: "var(--color-rp-text)" }}>
                Revoke Subdomain {deletingSubdomain.fqdn}?
              </h3>
            </div>

            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
              Are you sure you want to delete <strong>{deletingSubdomain.fqdn}</strong>? The SRV DNS record in Cloudflare will be immediately removed and players will no longer be able to connect using this address.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingSubdomain(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium border hover:bg-white/5 transition-colors"
                style={{
                  borderColor: "var(--color-rp-border)",
                  color: "var(--color-rp-text-muted)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubdomain}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all"
              >
                Delete &amp; Release SRV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
