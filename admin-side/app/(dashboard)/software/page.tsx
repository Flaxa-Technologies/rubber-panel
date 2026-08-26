"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package, Info, ExternalLink, RefreshCw, Search, Check, Filter,
  Layers, Terminal, Sparkles, ChevronRight, X, Box, Coffee, Plus,
  Download, Database, Code, Server, HardDrive, Trash2, CheckCircle2,
  Cpu, Zap, Shield, Globe
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface SoftwareVersion {
  id: string;
  version: string;
  isStable: boolean;
}

interface SoftwareItem {
  id: string;
  name: string;
  type: string;
  description: string | null;
  logoUrl: string | null;
  versions: SoftwareVersion[];
}

interface ContainerImageItem {
  id: string;
  name: string;
  category: "RUNTIME" | "DATABASE" | "WEB" | "CUSTOM";
  dockerImage: string;
  defaultPort: number;
  internalPort: number;
  defaultStartup?: string | null;
  environment: string;
  description?: string | null;
  icon?: string | null;
  nodeId?: string | null;
  node?: { id: string; name: string; status: string } | null;
  isOfficial: boolean;
  isPulled: boolean;
  lastPulledAt?: string | null;
  _count?: { servers: number };
}

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
  status: string;
}

interface JavaVersionItem {
  id: string;
  name: string;
  version: string;
  dockerImage?: string | null;
  isDefault: boolean;
  nodeId?: string | null;
  description?: string | null;
  _count?: { servers: number };
}

const typeColors: Record<string, string> = {
  JAVA: "rgba(34,197,94,0.15)",
  PAPER: "rgba(59,130,246,0.15)",
  PURPUR: "rgba(168,85,247,0.15)",
  FORGE: "rgba(249,115,22,0.15)",
  FABRIC: "rgba(234,179,8,0.15)",
  SPIGOT: "rgba(239,68,68,0.15)",
  PROXY: "rgba(168,85,247,0.15)",
  BUNGEECORD: "rgba(14,165,233,0.15)",
  VELOCITY: "rgba(59,130,246,0.15)",
  VANILLA: "rgba(34,197,94,0.15)",
  CUSTOM: "rgba(244,63,94,0.15)",
};

const categoryColors: Record<string, string> = {
  RUNTIME: "rgba(163,230,53,0.15)",
  DATABASE: "rgba(59,130,246,0.15)",
  WEB: "rgba(234,179,8,0.15)",
  CUSTOM: "rgba(168,85,247,0.15)",
};

const categoryTextColors: Record<string, string> = {
  RUNTIME: "var(--color-rp-accent)",
  DATABASE: "#60a5fa",
  WEB: "#facc15",
  CUSTOM: "#c084fc",
};

export default function SoftwarePage() {
  const [activeTab, setActiveTab] = useState<"software" | "images" | "java">("images");

  // Minecraft Software State
  const [softwareList, setSoftwareList] = useState<SoftwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [inspectSoftware, setInspectSoftware] = useState<SoftwareItem | null>(null);
  const [versionSearch, setVersionSearch] = useState("");

  // Container Images State
  const [imagesList, setImagesList] = useState<ContainerImageItem[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageCategoryFilter, setImageCategoryFilter] = useState("ALL");
  const [imageSearch, setImageSearch] = useState("");
  const [nodes, setNodes] = useState<NodeItem[]>([]);

  // Pull / Install Custom Image Modal State
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullTargetImage, setPullTargetImage] = useState<ContainerImageItem | null>(null);
  const [pullResultMsg, setPullResultMsg] = useState<{ success: boolean; message: string } | null>(null);

  const [pullForm, setPullForm] = useState({
    name: "",
    dockerImage: "",
    category: "RUNTIME" as "RUNTIME" | "DATABASE" | "WEB" | "CUSTOM",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "",
    environment: "{}",
    description: "",
    icon: "box",
    nodeId: "",
    pullNow: true,
  });

  // Java Versions State
  const [javaVersions, setJavaVersions] = useState<JavaVersionItem[]>([]);
  const [javaLoading, setJavaLoading] = useState(false);

  async function loadSoftware() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/software");
      if (res.ok) {
        const data = await res.json();
        setSoftwareList(data.software || []);
      }
    } catch (e) {
      console.error("Failed to load software:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadImages() {
    try {
      setImagesLoading(true);
      const res = await fetch("/api/admin/images");
      if (res.ok) {
        const data = await res.json();
        setImagesList(data.images || []);
      }
    } catch (e) {
      console.error("Failed to load images:", e);
    } finally {
      setImagesLoading(false);
    }
  }

  async function loadNodes() {
    try {
      const res = await fetch("/api/admin/nodes");
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        if (data.nodes?.length > 0 && !pullForm.nodeId) {
          setPullForm(f => ({ ...f, nodeId: data.nodes[0].id }));
        }
      }
    } catch (e) {
      console.error("Failed to load nodes:", e);
    }
  }

  async function loadJava() {
    try {
      setJavaLoading(true);
      const res = await fetch("/api/admin/java-versions");
      if (res.ok) {
        const data = await res.json();
        setJavaVersions(data.versions || []);
      }
    } catch (e) {
      console.error("Failed to load java versions:", e);
    } finally {
      setJavaLoading(false);
    }
  }

  async function syncUpstream() {
    try {
      setSyncing(true);
      const res = await fetch("/api/admin/software/sync", { method: "POST" });
      if (res.ok) {
        await loadSoftware();
      }
    } catch (e) {
      console.error("Failed to sync software:", e);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadSoftware();
    loadImages();
    loadNodes();
    loadJava();
  }, []);

  // Quick dispatch pull on node
  async function handleQuickPull(img: ContainerImageItem, targetNodeId: string) {
    try {
      setPullSubmitting(true);
      setPullResultMsg(null);
      const res = await fetch("/api/admin/images/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: img.id,
          dockerImage: img.dockerImage,
          nodeId: targetNodeId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPullResultMsg({ success: true, message: data.message || `Image pulled successfully on node!` });
        await loadImages();
      } else {
        setPullResultMsg({ success: false, message: data.error || "Failed to pull image on node" });
      }
    } catch (err: any) {
      setPullResultMsg({ success: false, message: err?.message || "Pull request failed" });
    } finally {
      setPullSubmitting(false);
    }
  }

  // Handle create/register new custom image
  async function handleCreateImage(e: React.FormEvent) {
    e.preventDefault();
    if (!pullForm.dockerImage.trim() || !pullForm.name.trim()) return;

    try {
      setPullSubmitting(true);
      setPullResultMsg(null);
      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pullForm),
      });
      const data = await res.json();
      if (res.ok) {
        setPullResultMsg({ success: true, message: `Image "${pullForm.name}" registered and online pull initiated on node!` });
        await loadImages();
        setTimeout(() => {
          setShowPullModal(false);
          setPullResultMsg(null);
        }, 1500);
      } else {
        setPullResultMsg({ success: false, message: data.error || "Failed to install custom image" });
      }
    } catch (err: any) {
      setPullResultMsg({ success: false, message: err?.message || "Failed to create image" });
    } finally {
      setPullSubmitting(false);
    }
  }

  async function handleDeleteImage(id: string) {
    if (!confirm("Are you sure you want to remove this container image template?")) return;
    try {
      const res = await fetch(`/api/admin/images?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadImages();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete image");
      }
    } catch (err: any) {
      alert(err?.message || "Delete request failed");
    }
  }

  const types = ["ALL", ...Array.from(new Set(softwareList.map(s => s.type)))];

  const filteredSoftware = softwareList.filter(s => {
    const matchesType = selectedType === "ALL" || s.type === selectedType;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || "").toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const filteredImages = imagesList.filter(img => {
    const matchesCat = imageCategoryFilter === "ALL" || img.category === imageCategoryFilter;
    const matchesSearch = img.name.toLowerCase().includes(imageSearch.toLowerCase()) ||
      img.dockerImage.toLowerCase().includes(imageSearch.toLowerCase()) ||
      (img.description || "").toLowerCase().includes(imageSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const totalVersions = softwareList.reduce((acc, s) => acc + s.versions.length, 0);

  function renderImageCategoryIcon(cat: string) {
    switch (cat) {
      case "DATABASE": return <Database className="w-4 h-4 text-blue-400" />;
      case "WEB": return <Globe className="w-4 h-4 text-yellow-400" />;
      case "RUNTIME": return <Code className="w-4 h-4 text-lime-400" />;
      default: return <Box className="w-4 h-4 text-purple-400" />;
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Top Main Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--color-rp-border)" }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
            Engines, Container Images &amp; Runtimes
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Install online Docker images (Python, Rust, MySQL, etc.) directly on nodes, manage Minecraft jars, and JVM runtimes.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border bg-black/20" style={{ borderColor: "var(--color-rp-border)" }}>
          <button
            onClick={() => setActiveTab("images")}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === "images"
              ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
              : { color: "var(--color-rp-text-muted)" }}
          >
            <Box className="w-4 h-4" />
            <span>Online Custom Images ({imagesList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("software")}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === "software"
              ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
              : { color: "var(--color-rp-text-muted)" }}
          >
            <Package className="w-4 h-4" />
            <span>Minecraft Engines ({softwareList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("java")}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === "java"
              ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
              : { color: "var(--color-rp-text-muted)" }}
          >
            <Coffee className="w-4 h-4" />
            <span>Java Runtimes ({javaVersions.length})</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: ONLINE CONTAINER IMAGES & MULTI-RUNTIMES ─── */}
      {activeTab === "images" && (
        <div className="space-y-5">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {["ALL", "RUNTIME", "DATABASE", "WEB", "CUSTOM"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setImageCategoryFilter(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border"
                  style={imageCategoryFilter === cat
                    ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                    : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  {cat === "ALL" ? "All Categories" : cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search images (python, rust, mysql)..."
                  value={imageSearch}
                  onChange={e => setImageSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none transition-all"
                  style={{
                    backgroundColor: "var(--color-rp-surface)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <button
                onClick={() => {
                  setPullResultMsg(null);
                  setShowPullModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm"
                style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
              >
                <Download className="w-4 h-4" />
                <span>Pull Image from Online</span>
              </button>
            </div>
          </div>

          {/* Preset Highlights / Info Banner */}
          <div className="p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-lime-950/10 border-lime-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-lime-400/20 text-lime-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-lime-400">Direct Online Image Pulls &amp; Registry</p>
                <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                  Pull any custom OCI image (Docker Hub, GHCR, Quay) onto particular nodes. You can also use the dedicated Container Images page.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/images"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-lime-400/30 bg-lime-400 text-black hover:bg-lime-300 transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Open /images Hub</span>
              </Link>
              <span className="text-[11px] px-2.5 py-1 rounded-full font-medium border bg-black/30 border-lime-500/30 text-lime-300">
                {imagesList.length} Ready
              </span>
            </div>
          </div>

          {/* Images Grid */}
          {imagesLoading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-lime-400" />
              <p className="text-xs">Loading container images catalog...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="py-16 text-center rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <Box className="w-10 h-10 mx-auto mb-3 opacity-30 text-lime-400" />
              <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>No container images found</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>Try searching a different keyword or click &quot;Pull Image from Online&quot;.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredImages.map(img => (
                <div
                  key={img.id}
                  className="rounded-xl border p-5 flex flex-col justify-between transition-all hover:border-lime-500/40"
                  style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                >
                  <div className="space-y-3">
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: categoryColors[img.category] || "rgba(255,255,255,0.05)",
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          {renderImageCategoryIcon(img.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm tracking-tight" style={{ color: "var(--color-rp-text)" }}>
                              {img.name}
                            </h3>
                            {img.isOfficial && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-lime-400/20 text-lime-400 border border-lime-400/30">
                                Official
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono mt-0.5 text-lime-400/90 break-all">
                            {img.dockerImage}
                          </p>
                        </div>
                      </div>

                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                        style={{
                          backgroundColor: categoryColors[img.category] || "rgba(255,255,255,0.05)",
                          color: categoryTextColors[img.category] || "#fff",
                        }}
                      >
                        {img.category}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
                      {img.description || "Custom online container runtime configuration."}
                    </p>

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="p-2 rounded-lg border bg-black/20" style={{ borderColor: "var(--color-rp-border)" }}>
                        <span className="text-[10px] block" style={{ color: "var(--color-rp-text-muted)" }}>Default Port</span>
                        <span className="font-mono font-semibold" style={{ color: "var(--color-rp-text)" }}>:{img.defaultPort}</span>
                      </div>
                      <div className="p-2 rounded-lg border bg-black/20" style={{ borderColor: "var(--color-rp-border)" }}>
                        <span className="text-[10px] block" style={{ color: "var(--color-rp-text-muted)" }}>Target Node</span>
                        <span className="font-medium" style={{ color: "var(--color-rp-text)" }}>
                          {img.node ? img.node.name : "Global (All Nodes)"}
                        </span>
                      </div>
                    </div>

                    {img.defaultStartup && (
                      <div className="p-2 rounded-lg border bg-black/30 font-mono text-[10px] truncate" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                        <span className="text-lime-400 font-bold">$ </span>{img.defaultStartup}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                      <Server className="w-3.5 h-3.5" />
                      <span>{img._count?.servers ?? 0} servers using</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {nodes.length > 0 && (
                        <button
                          onClick={() => {
                            setPullTargetImage(img);
                            handleQuickPull(img, nodes[0].id);
                          }}
                          disabled={pullSubmitting}
                          title={`Pull to ${nodes[0]?.name || "Node"}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border bg-lime-400/10 border-lime-400/30 text-lime-400 hover:bg-lime-400/20"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Pull to Node</span>
                        </button>
                      )}

                      {!img.isOfficial && (
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-1.5 rounded-lg border text-red-400 hover:bg-red-500/10 transition-all"
                          style={{ borderColor: "var(--color-rp-border)" }}
                          title="Delete custom image definition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: MINECRAFT ENGINES & CORES ─── */}
      {activeTab === "software" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border"
                  style={selectedType === t
                    ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                    : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search engines (paper, fabric, velocity)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none transition-all"
                  style={{
                    backgroundColor: "var(--color-rp-surface)",
                    borderColor: "var(--color-rp-border)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              <button
                onClick={syncUpstream}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                style={{
                  backgroundColor: "var(--color-rp-accent)",
                  color: "#000",
                  opacity: syncing ? 0.7 : 1,
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Upstream"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-lime-400" />
              <p className="text-xs">Loading Minecraft engines...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSoftware.map(sw => (
                <div
                  key={sw.id}
                  className="rounded-xl border p-5 flex flex-col justify-between transition-all hover:border-lime-500/40"
                  style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: typeColors[sw.type] || "rgba(255,255,255,0.05)",
                            borderColor: "rgba(255,255,255,0.1)",
                          }}
                        >
                          <Package className="w-4 h-4 text-lime-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                            {sw.name}
                          </h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide bg-black/40 border border-white/10 text-lime-400">
                            {sw.type}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold border bg-black/30" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                        {sw.versions.length} versions
                      </span>
                    </div>

                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
                      {sw.description || "Minecraft server software distribution."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" />
                      <span>Latest: {sw.versions[0]?.version || "Stable"}</span>
                    </div>
                    <button
                      onClick={() => setInspectSoftware(sw)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-lime-400/10 border-lime-400/30 text-lime-400 hover:bg-lime-400/20 transition-all"
                    >
                      <span>Inspect Versions</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: JAVA JVM RUNTIMES ─── */}
      {activeTab === "java" && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl border flex items-center justify-between gap-3 bg-lime-950/10 border-lime-500/20">
            <div className="flex items-center gap-3">
              <Coffee className="w-5 h-5 text-lime-400" />
              <div>
                <p className="text-xs font-bold text-lime-400">JVM Environments for Minecraft</p>
                <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                  Configured Java runtimes automatically matched during server startup (Java 8 through Java 23 LTS).
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium border bg-black/30 border-lime-500/30 text-lime-300">
              {javaVersions.length} Java Runtimes Registered
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {javaVersions.map(jvm => (
              <div
                key={jvm.id}
                className="rounded-xl border p-5 flex flex-col justify-between"
                style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-lime-400/15 text-lime-400 border border-lime-400/20">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>{jvm.name}</h4>
                        <p className="text-[11px] font-mono text-lime-400">Java {jvm.version}</p>
                      </div>
                    </div>
                    {jvm.isDefault && (
                      <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-lime-400/20 text-lime-400 border border-lime-400/30">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    {jvm.description || "OpenJDK runtime image for Minecraft servers."}
                  </p>

                  {jvm.dockerImage && (
                    <p className="text-[10px] font-mono p-2 rounded bg-black/30 border" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                      {jvm.dockerImage}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── PULL / INSTALL CUSTOM IMAGE MODAL ─── */}
      {showPullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border p-6 shadow-2xl space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: "var(--color-rp-text)" }}>
                    Install Custom Image from Online
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Download any container image directly onto a node and register it for server creation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPullModal(false)}
                className="p-1 rounded-lg border hover:bg-white/5 transition-all"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pullResultMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  pullResultMsg.success
                    ? "bg-lime-950/20 border-lime-500/40 text-lime-300"
                    : "bg-red-950/20 border-red-500/40 text-red-300"
                }`}
              >
                {pullResultMsg.success ? <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" /> : <Info className="w-4 h-4 text-red-400 shrink-0" />}
                <span>{pullResultMsg.message}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateImage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Python 3.12 AI Worker"
                    value={pullForm.name}
                    onChange={e => setPullForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Category *
                  </label>
                  <select
                    value={pullForm.category}
                    onChange={e => setPullForm(f => ({ ...f, category: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <option value="RUNTIME">Language Runtime (Python, Rust, Go, PHP)</option>
                    <option value="DATABASE">Database (MySQL, PostgreSQL, Redis, Mongo)</option>
                    <option value="WEB">Web Server (Nginx, Caddy, Apache)</option>
                    <option value="CUSTOM">Custom OCI Container</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Online Docker Image URL / Tag *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. python:3.12-alpine, rust:latest, mysql:8.0, ghcr.io/org/repo:tag"
                  value={pullForm.dockerImage}
                  onChange={e => setPullForm(f => ({ ...f, dockerImage: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                  Supported registries: Docker Hub, GitHub Container Registry (`ghcr.io`), Quay, or custom self-hosted registry URLs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Default Port
                  </label>
                  <input
                    type="number"
                    value={pullForm.defaultPort}
                    onChange={e => setPullForm(f => ({ ...f, defaultPort: parseInt(e.target.value) || 8080, internalPort: parseInt(e.target.value) || 8080 }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Target Node to Install
                  </label>
                  <select
                    value={pullForm.nodeId}
                    onChange={e => setPullForm(f => ({ ...f, nodeId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <option value="">Global (All Nodes)</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.fqdn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Default Startup Command (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. python -u main.py, cargo run --release, mysqld"
                  value={pullForm.defaultStartup}
                  onChange={e => setPullForm(f => ({ ...f, defaultStartup: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="What is this container image used for?"
                  value={pullForm.description}
                  onChange={e => setPullForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border outline-none resize-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowPullModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={pullSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                  style={{
                    backgroundColor: "var(--color-rp-accent)",
                    color: "#000",
                    opacity: pullSubmitting ? 0.7 : 1,
                  }}
                >
                  {pullSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{pullSubmitting ? "Pulling on Node..." : "Pull & Install Image"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── INSPECT SOFTWARE MODAL ─── */}
      {inspectSoftware && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: "var(--color-rp-text)" }}>
                    {inspectSoftware.name} Versions
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    {inspectSoftware.versions.length} versions available in catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectSoftware(null)}
                className="p-1 rounded-lg border hover:bg-white/5 transition-all"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
              <input
                type="text"
                placeholder="Filter versions (e.g. 1.21, 1.20)..."
                value={versionSearch}
                onChange={e => setVersionSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border outline-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {inspectSoftware.versions
                .filter(v => v.version.toLowerCase().includes(versionSearch.toLowerCase()))
                .map(v => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-lg border flex items-center justify-between text-xs bg-black/20"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  >
                    <span className="font-mono font-semibold" style={{ color: "var(--color-rp-text)" }}>
                      {inspectSoftware.name} {v.version}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-lime-400/10 text-lime-400 border border-lime-400/20">
                      {v.isStable ? "Stable" : "Snapshot"}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
              <button
                onClick={() => setInspectSoftware(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
