"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Blocks, Search, Download, Trash2, Check, AlertCircle,
  Loader2, CheckCircle2, PackageCheck, Layers, ExternalLink,
  Filter, Sparkles, X, ArrowDownToLine, RefreshCw, ChevronDown
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useServer } from "@/components/server/ServerContext";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface ModrinthProject {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: string;
  server_side: string;
  project_type: string;
  downloads: number;
  icon_url: string | null;
  author: string;
  versions: string[];
  latest_version: string;
  license: string;
}

interface ModrinthVersionFile {
  hashes: { sha1: string; sha512: string };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  version_type: "release" | "beta" | "alpha";
  date_published: string;
  downloads: number;
  files: ModrinthVersionFile[];
}

interface InstalledAddon {
  filename: string;
  type: "plugin" | "mod";
  sizeBytes: number;
  modifiedAt: string;
  path: string;
}

const LOADERS_LIST = [
  { id: "", label: "All Loaders" },
  { id: "paper", label: "Paper" },
  { id: "spigot", label: "Spigot" },
  { id: "purpur", label: "Purpur" },
  { id: "bukkit", label: "Bukkit" },
  { id: "fabric", label: "Fabric" },
  { id: "forge", label: "Forge" },
  { id: "neoforge", label: "NeoForge" },
];

const GAME_VERSIONS = [
  { id: "", label: "All Versions" },
  { id: "1.21.6", label: "1.21.6" },
  { id: "1.21.4", label: "1.21.4" },
  { id: "1.21.1", label: "1.21.1" },
  { id: "1.20.6", label: "1.20.6" },
  { id: "1.20.4", label: "1.20.4" },
  { id: "1.20.1", label: "1.20.1" },
  { id: "1.19.4", label: "1.19.4" },
  { id: "1.18.2", label: "1.18.2" },
  { id: "1.16.5", label: "1.16.5" },
  { id: "1.12.2", label: "1.12.2" },
];

const PAGE_SIZE = 24;

export default function ServerAddonsPage() {
  const { id } = useParams<{ id: string }>();
  const { server } = useServer();

  const [activeTab, setActiveTab] = useState<"browse" | "installed">("browse");
  const [query, setQuery] = useState("");
  const [projectType, setProjectType] = useState<"plugin" | "mod">("plugin");
  const [selectedLoader, setSelectedLoader] = useState("");
  const [selectedGameVersion, setSelectedGameVersion] = useState("");

  const [projects, setProjects] = useState<ModrinthProject[]>([]);
  const [offset, setOffset] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [installed, setInstalled] = useState<InstalledAddon[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);

  // Version Picker Modal
  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [projectVersions, setProjectVersions] = useState<ModrinthVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [installing, setInstalling] = useState(false);

  // Uninstall State
  const [uninstallTarget, setUninstallTarget] = useState<InstalledAddon | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchInstalled = useCallback(async () => {
    setLoadingInstalled(true);
    try {
      const res = await fetch(`/api/user/servers/${id}/addons/installed`);
      if (res.ok) {
        const data = await res.json();
        setInstalled(data.addons || []);
      }
    } catch {}
    setLoadingInstalled(false);
  }, [id]);

  const searchModrinth = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoadingSearch(true);
    }
    setError("");

    try {
      const currentOffset = isLoadMore ? offset : 0;
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      params.set("type", projectType);
      if (selectedLoader) params.set("loader", selectedLoader);
      if (selectedGameVersion) params.set("gameVersion", selectedGameVersion);
      params.set("limit", PAGE_SIZE.toString());
      params.set("offset", currentOffset.toString());

      const res = await fetch(`/api/user/servers/${id}/addons/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const hits: ModrinthProject[] = data.hits || [];
        setTotalHits(data.total_hits || 0);

        if (isLoadMore) {
          setProjects(prev => [...prev, ...hits]);
          setOffset(currentOffset + hits.length);
        } else {
          setProjects(hits);
          setOffset(hits.length);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to query Modrinth marketplace.");
      }
    } catch {
      setError("Network error connecting to Modrinth API.");
    }
    setLoadingSearch(false);
    setLoadingMore(false);
  }, [id, query, projectType, selectedLoader, selectedGameVersion, offset]);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  useEffect(() => {
    if (activeTab === "browse") {
      const debounce = setTimeout(() => {
        setOffset(0);
        searchModrinth(false);
      }, 250);
      return () => clearTimeout(debounce);
    }
  }, [activeTab, query, projectType, selectedLoader, selectedGameVersion]);

  const [modalTargetType, setModalTargetType] = useState<"plugin" | "mod">("plugin");

  async function fetchModalVersions(proj: ModrinthProject, forceAll = false) {
    setLoadingVersions(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("projectId", proj.slug || proj.project_id);
      if (!forceAll && selectedLoader) params.set("loader", selectedLoader);
      if (!forceAll && selectedGameVersion) params.set("gameVersion", selectedGameVersion);

      const res = await fetch(`/api/user/servers/${id}/addons/versions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const vers: ModrinthVersion[] = data.versions || [];
        setProjectVersions(vers);
        if (vers.length > 0) {
          setSelectedVersionId(vers[0].id);
        }
      } else {
        setError("Failed to fetch version list for this addon.");
      }
    } catch {
      setError("Failed to fetch version list for this addon.");
    }
    setLoadingVersions(false);
  }

  async function openProjectModal(proj: ModrinthProject) {
    setSelectedProject(proj);
    setModalTargetType(projectType);
    setProjectVersions([]);
    setSelectedVersionId("");
    fetchModalVersions(proj, false);
  }

  async function handleInstallVersion() {
    if (!selectedProject || !selectedVersionId) return;
    const version = projectVersions.find((v) => v.id === selectedVersionId);
    if (!version || version.files.length === 0) return;

    const file = version.files.find((f) => f.primary) || version.files[0];
    setInstalling(true);
    setError("");

    try {
      const res = await fetch(`/api/user/servers/${id}/addons/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: file.url,
          filename: file.filename,
          type: modalTargetType,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Installed "${file.filename}" directly to server /${data.type}/.`);
        setTimeout(() => setSuccess(""), 4500);
        setSelectedProject(null);
        fetchInstalled();
      } else {
        setError(data.error || "Installation failed.");
      }
    } catch {
      setError("Network error installing addon.");
    }
    setInstalling(false);
  }

  async function confirmUninstall() {
    if (!uninstallTarget) return;
    setUninstalling(true);
    try {
      const res = await fetch(`/api/user/servers/${id}/addons/uninstall`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uninstallTarget.filename,
          type: uninstallTarget.type,
        }),
      });
      if (res.ok) {
        setSuccess(`Removed ${uninstallTarget.filename}`);
        setTimeout(() => setSuccess(""), 3500);
        setUninstallTarget(null);
        fetchInstalled();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to remove addon file.");
      }
    } catch {
      setError("Network error removing addon.");
    }
    setUninstalling(false);
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function formatDownloads(num: number) {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
    return num.toString();
  }

  if (server?.serverType === "NODEJS") {
    return (
      <div className="saas-card" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80", marginBottom: 16 }}>
          <Blocks size={22} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Addons &amp; Plugins Not Applicable</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 440, lineHeight: 1.5 }}>
          This server is running as a <strong>Node.js</strong> application instance. Minecraft plugins and mods are only supported on Minecraft software environments.
        </p>
        <Link href={`/servers/${id}/files`} className="btn-solid-white" style={{ marginTop: 16, padding: "8px 16px", fontSize: 12.5, textDecoration: "none" }}>
          Open File Manager &amp; package.json
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Banner & Switcher */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Blocks size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              Addon Marketplace &amp; Installer
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Browse popular Minecraft plugins &amp; mods directly from Modrinth. Instant 1-click node download.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-surface-elevated)", padding: 3, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
          <button
            onClick={() => setActiveTab("browse")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: activeTab === "browse" ? "#ffffff" : "transparent",
              color: activeTab === "browse" ? "#000000" : "var(--text-muted)",
              fontWeight: activeTab === "browse" ? 700 : 500,
              fontSize: 12.5,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Browse Marketplace
          </button>
          <button
            onClick={() => setActiveTab("installed")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: activeTab === "installed" ? "#ffffff" : "transparent",
              color: activeTab === "installed" ? "#000000" : "var(--text-muted)",
              fontWeight: activeTab === "installed" ? 700 : 500,
              fontSize: 12.5,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>Installed</span>
            <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 9999, background: activeTab === "installed" ? "#000000" : "var(--bg-surface)", color: activeTab === "installed" ? "#ffffff" : "var(--text-primary)" }}>
              {installed.length}
            </span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-sm)", color: "#f87171", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-sm)", color: "#34d399", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {/* BROWSE TAB */}
      {activeTab === "browse" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter Bar */}
          <div className="saas-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Search Input + Type Toggle */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 260px" }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search plugins & mods (e.g. EssentialsX, Geyser, WorldEdit, Sodium)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="saas-input"
                  style={{ paddingLeft: 34, height: 38 }}
                />
              </div>

              {/* Type Switcher: Plugin vs Mod */}
              <div style={{ display: "flex", gap: 4, background: "var(--bg-surface-elevated)", padding: 3, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setProjectType("plugin")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: projectType === "plugin" ? "#ffffff" : "transparent",
                    color: projectType === "plugin" ? "#000000" : "var(--text-muted)",
                    fontWeight: projectType === "plugin" ? 700 : 500,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Plugins (/plugins)
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType("mod")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: projectType === "mod" ? "#ffffff" : "transparent",
                    color: projectType === "mod" ? "#000000" : "var(--text-muted)",
                    fontWeight: projectType === "mod" ? 700 : 500,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Mods (/mods)
                </button>
              </div>
            </div>

            {/* Sub-Filters: Loader & Game Version */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                  Loader:
                </span>
                <select
                  value={selectedLoader}
                  onChange={(e) => setSelectedLoader(e.target.value)}
                  className="saas-input"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                >
                  {LOADERS_LIST.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                  Version:
                </span>
                <select
                  value={selectedGameVersion}
                  onChange={(e) => setSelectedGameVersion(e.target.value)}
                  className="saas-input"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                >
                  {GAME_VERSIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => searchModrinth(false)}
                className="btn-secondary-dark"
                style={{ padding: "6px 12px", fontSize: 12, marginLeft: "auto" }}
              >
                <RefreshCw size={12} className={loadingSearch ? "spin" : ""} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Projects Grid */}
          {loadingSearch ? (
            <div className="saas-card" style={{ padding: 60, textAlign: "center" }}>
              <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px", color: "var(--text-muted)" }} />
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Searching Modrinth Marketplace...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="saas-card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              <Blocks size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-pure)" }}>No addons found</h3>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                Try adjusting your search query or removing loader/version filters.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
                {projects.map((proj) => {
                  const modrinthWebUrl = `https://modrinth.com/${proj.project_type}/${proj.slug || proj.project_id}`;
                  return (
                    <div
                      key={proj.project_id}
                      className="saas-card saas-card-interactive"
                      style={{
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 12,
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12 }}>
                        {/* Addon Icon */}
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            background: "var(--bg-surface-elevated)",
                            border: "1px solid var(--border-medium)",
                            overflow: "hidden",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                          }}
                        >
                          {proj.icon_url ? (
                            <Image
                              src={proj.icon_url}
                              alt={proj.title}
                              fill
                              sizes="44px"
                              style={{ objectFit: "cover" }}
                              unoptimized
                            />
                          ) : (
                            <Blocks size={20} style={{ color: "var(--text-dim)" }} />
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <h3
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--text-pure)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {proj.title}
                            </h3>
                            <a
                              href={modrinthWebUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--text-dim)", padding: 2 }}
                              title="View on Modrinth.com"
                              className="hover:text-white"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                            by {proj.author}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          minHeight: 34,
                        }}
                      >
                        {proj.description || "No description provided."}
                      </p>

                      {/* Badges & Install Action */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)", flexWrap: "wrap", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-dim)" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Download size={12} />
                            {formatDownloads(proj.downloads)}
                          </span>
                          <span>·</span>
                          <span style={{ textTransform: "capitalize" }}>{proj.project_type}</span>
                        </div>

                        <button
                          onClick={() => openProjectModal(proj)}
                          className="btn-solid-white"
                          style={{ padding: "5px 12px", fontSize: 12 }}
                        >
                          <ArrowDownToLine size={13} />
                          <span>Install</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {projects.length < totalHits && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <button
                    onClick={() => searchModrinth(true)}
                    disabled={loadingMore}
                    className="btn-secondary-dark"
                    style={{ padding: "8px 24px", fontSize: 13 }}
                  >
                    {loadingMore ? <Loader2 size={14} className="spin" /> : <ChevronDown size={14} />}
                    <span>{loadingMore ? "Loading More..." : `Load More Addons (${projects.length} of ${totalHits})`}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* INSTALLED TAB */}
      {activeTab === "installed" && (
        <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
              Installed Addons ({installed.length})
            </span>
            <button
              onClick={fetchInstalled}
              className="btn-secondary-dark"
              style={{ padding: "4px 8px", fontSize: 11.5 }}
            >
              <RefreshCw size={12} className={loadingInstalled ? "spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingInstalled ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <Loader2 size={22} className="spin" style={{ margin: "0 auto", color: "var(--text-muted)" }} />
            </div>
          ) : installed.length === 0 ? (
            <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>
              <PackageCheck size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-pure)" }}>No addons installed</h3>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                Switch to &quot;Browse Marketplace&quot; to search and one-click install plugins and mods.
              </p>
            </div>
          ) : (
            <div>
              {installed.map((item) => (
                <div
                  key={item.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: item.type === "plugin" ? "#38bdf8" : "#a855f7",
                      }}
                    >
                      <Blocks size={16} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-pure)" }}>
                          {item.filename}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 9999,
                            background: item.type === "plugin" ? "rgba(56,189,248,0.12)" : "rgba(168,85,247,0.12)",
                            color: item.type === "plugin" ? "#38bdf8" : "#c084fc",
                            textTransform: "uppercase",
                          }}
                        >
                          {item.type}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>
                        <span>{formatBytes(item.sizeBytes)}</span>
                        <span>·</span>
                        <span>{item.path}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setUninstallTarget(item)}
                    className="btn-secondary-dark"
                    style={{ padding: "5px 8px", color: "#f87171" }}
                    title="Uninstall / Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version Picker & Install Modal */}
      {selectedProject && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-box" style={{ maxWidth: 580, background: "var(--bg-surface)", border: "1px solid var(--border-medium)" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-surface)", border: "1px solid var(--border-medium)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {selectedProject.icon_url ? (
                    <Image src={selectedProject.icon_url} alt="" fill sizes="32px" style={{ objectFit: "cover" }} unoptimized />
                  ) : (
                    <Blocks size={16} style={{ color: "var(--text-pure)" }} />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    Install {selectedProject.title}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Target directory: /{selectedProject.project_type === "mod" ? "mods" : "plugins"}/</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(90vh - 130px)" }}>
              {/* Description */}
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {selectedProject.description}
              </p>

              {/* Target Directory Selection */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Install Destination
                </label>
                <div style={{ display: "flex", gap: 6, background: "var(--bg-surface-elevated)", padding: 4, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <button
                    type="button"
                    onClick={() => setModalTargetType("plugin")}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: modalTargetType === "plugin" ? "#ffffff" : "transparent",
                      color: modalTargetType === "plugin" ? "#000000" : "var(--text-muted)",
                      fontWeight: modalTargetType === "plugin" ? 700 : 500,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Plugins Folder (/plugins/)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTargetType("mod")}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: modalTargetType === "mod" ? "#ffffff" : "transparent",
                      color: modalTargetType === "mod" ? "#000000" : "var(--text-muted)",
                      fontWeight: modalTargetType === "mod" ? 700 : 500,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Mods Folder (/mods/)
                  </button>
                </div>
              </div>

              {/* Version Selector */}
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Select Release Version
                </label>

                {loadingVersions ? (
                  <div style={{ padding: 24, textAlign: "center" }}>
                    <Loader2 size={18} className="spin" style={{ margin: "0 auto 6px", color: "var(--text-muted)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Fetching compatible versions...</span>
                  </div>
                ) : projectVersions.length === 0 ? (
                  <div style={{ padding: 16, background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                    <span>No versions found matching the current filter.</span>
                    {selectedProject && (
                      <button
                        type="button"
                        onClick={() => fetchModalVersions(selectedProject, true)}
                        className="btn-solid-white"
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        Show All Versions
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                    {projectVersions.map((v) => {
                      const isSelected = selectedVersionId === v.id;
                      const primaryFile = v.files.find((f) => f.primary) || v.files[0];

                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVersionId(v.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "var(--radius-sm)",
                            background: isSelected ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                            border: isSelected ? "1px solid #ffffff" : "1px solid var(--border-subtle)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            transition: "all 0.1s ease",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-pure)" }}>
                                {v.name || v.version_number}
                              </span>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  background: v.version_type === "release" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                                  color: v.version_type === "release" ? "#34d399" : "#fbbf24",
                                  textTransform: "uppercase",
                                }}
                              >
                                {v.version_type}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>
                              <span>MC {v.game_versions.slice(0, 3).join(", ")}{v.game_versions.length > 3 ? "..." : ""}</span>
                              <span>·</span>
                              <span>{primaryFile ? formatBytes(primaryFile.size) : ""}</span>
                            </div>
                          </div>

                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              border: isSelected ? "5px solid #ffffff" : "1.5px solid var(--border-medium)",
                              background: isSelected ? "var(--bg-app)" : "transparent",
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="btn-secondary-dark"
                style={{ padding: "7px 14px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={installing || !selectedVersionId || projectVersions.length === 0}
                onClick={handleInstallVersion}
                className="btn-solid-white"
                style={{ padding: "7px 16px" }}
              >
                {installing ? <Loader2 size={13} className="spin" /> : <ArrowDownToLine size={13} />}
                <span>{installing ? "Installing on Node..." : "Download & Install"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Uninstall Confirmation Dialog */}
      <ConfirmationDialog
        open={!!uninstallTarget}
        title="Uninstall Addon"
        description={`Are you sure you want to remove "${uninstallTarget?.filename}" from server /${uninstallTarget?.type}s/?`}
        confirmLabel="Uninstall File"
        destructive
        loading={uninstalling}
        onConfirm={confirmUninstall}
        onCancel={() => setUninstallTarget(null)}
      />
    </div>
  );
}
