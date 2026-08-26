"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Server, Terminal, FolderOpen, Sliders, Shield, ArrowLeft,
  Play, Square, RotateCcw, Zap, RefreshCw, Upload, Archive,
  Save, Trash2, Edit2, FilePlus, FolderPlus, Loader2, Lock,
  ChevronRight, Home, ExternalLink, CheckCircle2, ShieldAlert, Cpu, HardDrive,
  FileText, Copy, Check, Globe, Code, Database, Box,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/Badge";

interface ServerDetail {
  id: string;
  name: string;
  uuid: string;
  status: string;
  suspended: boolean;
  ram: number;
  cpu: number;
  disk: number;
  swap: number;
  startupCommand: string;
  allowedPaths: string;
  protectedPaths: string;
  createdAt: string;
  owner: { id: string; username: string; email: string } | null;
  node: { id: string; name: string; fqdn: string; status: string } | null;
  software: { id: string; name: string; type: string } | null;
  serverType?: string;
  nodeVersion?: string;
  javaVersion?: string;
  cryoSleepEnabled?: boolean;
  cryoSleepIdleMinutes?: number;
  cryoSleepCustomMotdAllowed?: boolean;
  cryoSleepMotd?: string | null;
  allocations: { id: string; ip: string; port: number }[];
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export default function AdminServerManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [server, setServer] = useState<ServerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"console" | "files" | "resources" | "paths">("console");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // ── Console State ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [sendingCmd, setSendingCmd] = useState(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const sinceRef = useRef<number>(0);

  // ── Files State ────────────────────────────────────────────────────────────
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [promptCreate, setPromptCreate] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Resource Edit State ───────────────────────────────────────────────────
  const [resForm, setResForm] = useState({ ram: "1024", cpu: "100", disk: "5120", startupCommand: "" });
  const [savingRes, setSavingRes] = useState(false);
  const [resSuccess, setResSuccess] = useState("");

  const loadServer = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/servers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setServer(data);
        setResForm({
          ram: String(data.ram ?? 1024),
          cpu: String(data.cpu ?? 100),
          disk: String(data.disk ?? 5120),
          startupCommand: data.startupCommand ?? "",
        });
      } else {
        setError("Failed to load server details");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadServer();
    const interval = setInterval(loadServer, 3000);
    return () => clearInterval(interval);
  }, [loadServer]);

  // Console log stream polling
  useEffect(() => {
    if (activeTab !== "console") return;
    let active = true;

    async function pollConsole() {
      try {
        const res = await fetch(`/api/admin/servers/${id}/console?since=${sinceRef.current}`);
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data.logs) && data.logs.length > 0) {
            setLogs(prev => [...prev.slice(-400), ...data.logs]);
            sinceRef.current = data.nextSince ?? (sinceRef.current + data.logs.length);
          }
        }
      } catch {}
    }

    pollConsole();
    const interval = setInterval(pollConsole, 1200);
    return () => { active = false; clearInterval(interval); };
  }, [id, activeTab]);

  useEffect(() => {
    if (activeTab === "console") {
      consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Files loader
  async function loadFiles(path: string) {
    setFilesLoading(true);
    setCurrentPath(path);
    try {
      const res = await fetch(`/api/admin/servers/${id}/files?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {}
    setFilesLoading(false);
  }

  useEffect(() => {
    if (activeTab === "files") {
      loadFiles(currentPath);
    }
  }, [activeTab]);

  async function handlePower(action: "start" | "stop" | "restart" | "kill") {
    setActionLoading(action);
    try {
      await fetch(`/api/admin/servers/${id}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTimeout(loadServer, 1000);
    } catch {}
    setActionLoading(null);
  }

  async function handleToggleSuspend() {
    if (!server) return;
    setActionLoading("suspend");
    try {
      await fetch(`/api/admin/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !server.suspended }),
      });
      await loadServer();
    } catch {}
    setActionLoading(null);
  }

  async function handleSendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim() || sendingCmd) return;
    const cmd = command.trim();
    setCommand("");
    setSendingCmd(true);
    try {
      await fetch(`/api/admin/servers/${id}/console`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
    } catch {}
    setSendingCmd(false);
  }

  async function openEditor(filename: string) {
    const fullPath = (currentPath === "/" ? "/" : currentPath + "/") + filename;
    try {
      const res = await fetch(`/api/admin/servers/${id}/files?action=read&path=${encodeURIComponent(fullPath)}`);
      if (res.ok) {
        const data = await res.json();
        setEditingFile({ path: fullPath, content: data.content });
      }
    } catch {}
  }

  async function saveFile() {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      await fetch(`/api/admin/servers/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: editingFile.path, content: editingFile.content, action: "write" }),
      });
      setEditingFile(null);
      loadFiles(currentPath);
    } catch {}
    setSavingFile(false);
  }

  async function handleCreateFile() {
    if (!newItemName.trim()) return;
    const fullPath = (currentPath === "/" ? "/" : currentPath + "/") + newItemName.trim();
    try {
      await fetch(`/api/admin/servers/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath, content: "", action: "write" }),
      });
      setPromptCreate(null);
      setNewItemName("");
      loadFiles(currentPath);
    } catch {}
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const targetPath = (currentPath === "/" ? "/" : currentPath + "/") + file.name;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            resolve(res.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await fetch(`/api/admin/servers/${id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: targetPath, action: "upload", base64Content: base64 }),
        });
      }
      loadFiles(currentPath);
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleExtract(filename: string) {
    const fullPath = (currentPath === "/" ? "/" : currentPath + "/") + filename;
    setExtracting(filename);
    try {
      await fetch(`/api/admin/servers/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath, action: "unzip", destination: currentPath }),
      });
      loadFiles(currentPath);
    } catch {}
    setExtracting(null);
  }

  async function handleDeleteFile(filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;
    const fullPath = (currentPath === "/" ? "/" : currentPath + "/") + filename;
    try {
      await fetch(`/api/admin/servers/${id}/files?path=${encodeURIComponent(fullPath)}`, { method: "DELETE" });
      loadFiles(currentPath);
    } catch {}
  }

  async function saveResources(e: React.FormEvent) {
    e.preventDefault();
    setSavingRes(true);
    try {
      const res = await fetch(`/api/admin/servers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ram: parseInt(resForm.ram),
          cpu: parseInt(resForm.cpu),
          disk: parseInt(resForm.disk),
          startupCommand: resForm.startupCommand,
        }),
      });
      if (res.ok) {
        setResSuccess("Resources updated live.");
        setTimeout(() => setResSuccess(""), 3000);
        await loadServer();
      }
    } catch {}
    setSavingRes(false);
  }

  if (loading && !server) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-rp-accent)" }} />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-400 font-semibold">{error || "Server not found"}</p>
        <Link href="/servers" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border hover:bg-white/5">
          <ArrowLeft className="w-4 h-4" /> Back to Servers
        </Link>
      </div>
    );
  }

  const primaryAlloc = server.allocations?.[0];
  const port = primaryAlloc?.port ?? 25565;
  const rawIp = primaryAlloc?.ip;
  const fullAddress = (rawIp && rawIp !== "0.0.0.0" && rawIp !== "127.0.0.1")
    ? `${rawIp}:${port}`
    : (server.node?.fqdn && server.node.fqdn !== "127.0.0.1" && server.node.fqdn !== "localhost")
      ? `${server.node.fqdn}:${port}`
      : primaryAlloc ? `${primaryAlloc.ip}:${primaryAlloc.port}` : "—";

  const handleCopyAddress = () => {
    if (!fullAddress || fullAddress === "—") return;
    navigator.clipboard.writeText(fullAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="space-y-6 w-full animate-fade-in pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/servers" className="p-2 rounded-lg border hover:bg-white/5 transition-colors" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold truncate max-w-xl" title={server.name} style={{ color: "var(--color-rp-text)" }}>{server.name}</h1>
              {server.serverType === "NODEJS" ? (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Node.js v{server.nodeVersion || "20"}</span>
                </span>
              ) : server.serverType === "PYTHON" ? (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-lime-500/15 text-lime-400 border border-lime-500/25 flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  <span>Python Runtime</span>
                </span>
              ) : server.serverType === "RUST" ? (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  <span>Rust Engine</span>
                </span>
              ) : server.serverType === "DATABASE" ? (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  <span>Database</span>
                </span>
              ) : server.serverType === "CUSTOM" ? (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center gap-1">
                  <Box className="w-3 h-3" />
                  <span>Custom Container</span>
                </span>
              ) : (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  Java {server.javaVersion || "21"}
                </span>
              )}
              <StatusBadge status={server.status} />
              {server.suspended && <Badge variant="danger" size="sm">Suspended</Badge>}

              {/* Click to Copy Full Server Address */}
              <button
                type="button"
                onClick={handleCopyAddress}
                title="Click to copy full connection address"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium transition-all"
                style={{
                  backgroundColor: copiedAddress ? "rgba(56, 189, 248, 0.15)" : "var(--color-rp-surface)",
                  borderColor: copiedAddress ? "rgba(56, 189, 248, 0.4)" : "var(--color-rp-border)",
                  borderWidth: 1,
                  color: copiedAddress ? "#38bdf8" : "var(--color-rp-text-secondary)",
                }}
              >
                <Globe className="w-3 h-3" style={{ color: copiedAddress ? "#38bdf8" : "var(--color-rp-text-muted)" }} />
                <span>{fullAddress}</span>
                {copiedAddress ? <Check className="w-3 h-3 text-sky-400" /> : <Copy className="w-3 h-3 text-white/40" />}
              </button>
            </div>
            <p className="text-xs font-mono mt-1 truncate max-w-2xl" style={{ color: "var(--color-rp-text-dim)" }}>
              Node: {server.node?.name || "Local"} · Owner: {server.owner?.username} ({server.owner?.email})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Power Controls */}
          {server.status === "RUNNING" ? (
            <>
              <button
                onClick={() => handlePower("stop")}
                disabled={actionLoading === "stop"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
              <button
                onClick={() => handlePower("restart")}
                disabled={actionLoading === "restart"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restart
              </button>
            </>
          ) : (
            <button
              onClick={() => handlePower("start")}
              disabled={actionLoading === "start" || server.suspended}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          )}

          <button
            onClick={() => handlePower("kill")}
            disabled={actionLoading === "kill"}
            className="p-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            title="Force Kill Container"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleToggleSuspend}
            disabled={actionLoading === "suspend"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
            style={server.suspended
              ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", borderColor: "rgba(16,185,129,0.3)" }
              : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
          >
            {server.suspended ? "Unsuspend" : "Suspend"}
          </button>

          <a
            href={`http://localhost:3002/servers/${server.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white border hover:bg-white/5 transition-all"
            style={{ borderColor: "var(--color-rp-border)" }}
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>User POV</span>
          </a>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 p-1.5 rounded-xl border bg-black/40" style={{ borderColor: "var(--color-rp-border)" }}>
        {[
          { id: "console", label: "Live Terminal", icon: Terminal },
          { id: "files", label: "Root File Manager", icon: FolderOpen },
          { id: "resources", label: "Resources & Startup", icon: Sliders },
          { id: "paths", label: "Permissions & Paths", icon: Shield },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={
                active
                  ? { backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)", border: "1px solid var(--color-rp-accent)" }
                  : { color: "var(--color-rp-text-muted)", border: "1px solid transparent" }
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Console */}
      {activeTab === "console" && (
        <div className="space-y-3">
          <div
            className="p-4 rounded-2xl border font-mono text-xs overflow-y-auto space-y-1 h-[480px] bg-black shadow-inner"
            style={{ borderColor: "var(--color-rp-border)" }}
          >
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic py-8 text-center">Connecting to container log stream...</div>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="leading-relaxed whitespace-pre-wrap text-zinc-300 font-mono text-[12px]">
                  {line}
                </div>
              ))
            )}
            <div ref={consoleBottomRef} />
          </div>

          <form onSubmit={handleSendCommand} className="flex gap-2">
            <input
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="Send console command to container (e.g. list, help, op username)..."
              className="flex-1 px-4 py-2.5 rounded-xl border text-xs font-mono outline-none"
              style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
            />
            <button
              type="submit"
              disabled={sendingCmd}
              className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000000" }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: File Manager */}
      {activeTab === "files" && (
        <div className="space-y-4">
          {editingFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditingFile(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5 flex items-center gap-1.5" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <span className="font-mono text-xs font-bold text-white">{editingFile.path}</span>
                </div>
                <button
                  onClick={saveFile}
                  disabled={savingFile}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000000" }}
                >
                  {savingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save File</span>
                </button>
              </div>

              <textarea
                value={editingFile.content}
                onChange={e => setEditingFile({ ...editingFile, content: e.target.value })}
                rows={22}
                className="w-full p-4 rounded-xl border font-mono text-xs outline-none bg-black text-zinc-200"
                style={{ borderColor: "var(--color-rp-border)" }}
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* File Action Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs p-2 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                  <button onClick={() => loadFiles("/")} className="hover:text-white flex items-center gap-1 text-zinc-400">
                    <Home className="w-3.5 h-3.5" /> root
                  </button>
                  {pathParts.map((p, i) => {
                    const full = "/" + pathParts.slice(0, i + 1).join("/");
                    return (
                      <span key={full} className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                        <button onClick={() => loadFiles(full)} className="hover:text-white text-zinc-300 font-medium">
                          {p}
                        </button>
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? "Uploading..." : "Upload File / .zip"}</span>
                  </button>
                  <button
                    onClick={() => setPromptCreate("file")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => setPromptCreate("folder")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>New Folder</span>
                  </button>
                </div>
              </div>

              {promptCreate && (
                <div className="p-3 rounded-xl border flex items-center gap-2" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder={promptCreate === "file" ? "e.g. server.properties" : "e.g. plugins"}
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreateFile()}
                    className="px-3 py-1.5 rounded-lg text-xs border outline-none w-64"
                    style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                  <button onClick={handleCreateFile} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-black">Create</button>
                  <button onClick={() => { setPromptCreate(null); setNewItemName(""); }} className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-white/5">Cancel</button>
                </div>
              )}

              {/* Files Table */}
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
                      <th className="p-3 w-8"></th>
                      <th className="p-3">File Name</th>
                      <th className="p-3 w-28">Size</th>
                      <th className="p-3 w-36">Modified</th>
                      <th className="p-3 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                    {filesLoading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : files.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">Directory is empty.</td>
                      </tr>
                    ) : (
                      files.map(f => {
                        const isZip = f.name.endsWith(".zip") || f.name.endsWith(".tar.gz");
                        return (
                          <tr key={f.name} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3 text-zinc-400">
                              {f.isDirectory ? <FolderOpen className="w-4 h-4 text-emerald-400" /> : isZip ? <Archive className="w-4 h-4 text-sky-400" /> : <FileText className="w-4 h-4 text-zinc-400" />}
                            </td>
                            <td className="p-3">
                              {f.isDirectory ? (
                                <button
                                  onClick={() => loadFiles((currentPath === "/" ? "/" : currentPath + "/") + f.name)}
                                  className="font-medium text-white hover:underline text-left"
                                >
                                  {f.name}
                                </button>
                              ) : (
                                <button onClick={() => openEditor(f.name)} className="text-zinc-300 hover:underline text-left">
                                  {f.name}
                                </button>
                              )}
                            </td>
                            <td className="p-3 font-mono text-zinc-500">{f.isDirectory ? "—" : `${Math.round(f.size / 1024)} KB`}</td>
                            <td className="p-3 text-zinc-500">{new Date(f.modifiedAt).toLocaleDateString()}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isZip && (
                                  <button
                                    onClick={() => handleExtract(f.name)}
                                    disabled={extracting === f.name}
                                    title="Unzip Archive"
                                    className="p-1 rounded hover:bg-white/10 text-sky-400"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {!f.isDirectory && (
                                  <button onClick={() => openEditor(f.name)} title="Edit" className="p-1 rounded hover:bg-white/10 text-zinc-300">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button onClick={() => handleDeleteFile(f.name)} title="Delete" className="p-1 rounded hover:bg-red-500/10 text-red-400">
                                  <Trash2 className="w-3.5 h-3.5" />
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
          )}
        </div>
      )}

      {/* TAB 3: Resources */}
      {activeTab === "resources" && (
        <form onSubmit={saveResources} className="p-6 rounded-2xl border space-y-4" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Resource Allocation & Hardware</span>
          </h3>

          {resSuccess && (
            <div className="p-3 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {resSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>RAM (MB)</label>
              <input
                type="number"
                value={resForm.ram}
                onChange={e => setResForm({ ...resForm, ram: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>CPU Limit (%)</label>
              <input
                type="number"
                value={resForm.cpu}
                onChange={e => setResForm({ ...resForm, cpu: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>Disk Limit (MB)</label>
              <input
                type="number"
                value={resForm.disk}
                onChange={e => setResForm({ ...resForm, disk: e.target.value })}
                className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>Startup Command</label>
            <input
              type="text"
              value={resForm.startupCommand}
              onChange={e => setResForm({ ...resForm, startupCommand: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg text-sm font-mono border outline-none"
              style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingRes}
              className="px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000000" }}
            >
              {savingRes ? "Saving..." : "Save Hardware Allocations"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: Paths & Permissions */}
      {activeTab === "paths" && (
        <div className="p-6 rounded-2xl border space-y-4" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
            <Shield className="w-4 h-4 text-purple-400" />
            <span>Filesystem Permissions & Enforced Paths</span>
          </h3>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Allowed Paths for Normal Users</div>
              <div className="text-xs text-zinc-300 font-mono">
                {server.allowedPaths || "No restrictions (all directories allowed)"}
              </div>
              <p className="text-[11px] text-zinc-500">
                Directories the user is allowed to browse, create files in, upload to, and extract archives.
              </p>
            </div>

            <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
              <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">Protected System Paths</div>
              <div className="text-xs text-zinc-300 font-mono">
                {server.protectedPaths || "[\"/server.jar\", \"/start.sh\"]"}
              </div>
              <p className="text-[11px] text-zinc-500">
                Files and directories regular users are strictly forbidden from modifying, overwriting, or deleting.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
