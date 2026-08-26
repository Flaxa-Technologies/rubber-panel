"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Zap,
  Moon,
  Sun,
  Shield,
  Server,
  MonitorSpeaker,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  Save,
  Pencil,
  RotateCcw,
  Sparkles,
  Sliders,
  Users,
  Copy,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  Lock,
  Unlock,
  Radio,
  Play,
  Square,
  Loader2,
  Info,
  X
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Toggle } from "@/components/ui/Input";
import { StatusBadge, Badge } from "@/components/ui/Badge";

interface ServerItem {
  id: string;
  name: string;
  uuid: string;
  status: string;
  suspended: boolean;
  ram: number;
  cpu: number;
  disk: number;
  serverType?: string;
  cryoSleepEnabled?: boolean;
  cryoSleepIdleMinutes?: number;
  cryoSleepCustomMotdAllowed?: boolean;
  cryoSleepMotd?: string | null;
  owner?: { id: string; username: string; email: string } | null;
  node?: { id: string; name: string; status: string } | null;
  allocations: { id: string; ip: string; port: number }[];
  isCryoSleeping?: boolean;
}

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  status: string;
  agentVersion?: string;
  lastHeartbeat?: string;
}

const MINECRAFT_COLORS = [
  { code: "§0", name: "Black", hex: "#000000", bg: "#000000" },
  { code: "§1", name: "Dark Blue", hex: "#0000aa", bg: "#0000aa" },
  { code: "§2", name: "Dark Green", hex: "#00aa00", bg: "#00aa00" },
  { code: "§3", name: "Dark Aqua", hex: "#00aaaa", bg: "#00aaaa" },
  { code: "§4", name: "Dark Red", hex: "#aa0000", bg: "#aa0000" },
  { code: "§5", name: "Dark Purple", hex: "#aa00aa", bg: "#aa00aa" },
  { code: "§6", name: "Gold", hex: "#ffaa00", bg: "#ffaa00" },
  { code: "§7", name: "Gray", hex: "#aaaaaa", bg: "#aaaaaa" },
  { code: "§8", name: "Dark Gray", hex: "#555555", bg: "#555555" },
  { code: "§9", name: "Blue", hex: "#5555ff", bg: "#5555ff" },
  { code: "§a", name: "Green", hex: "#55ff55", bg: "#55ff55" },
  { code: "§b", name: "Aqua", hex: "#55ffff", bg: "#55ffff" },
  { code: "§c", name: "Red", hex: "#ff5555", bg: "#ff5555" },
  { code: "§d", name: "Light Purple", hex: "#ff55ff", bg: "#ff55ff" },
  { code: "§e", name: "Yellow", hex: "#ffff55", bg: "#ffff55" },
  { code: "§f", name: "White", hex: "#ffffff", bg: "#ffffff" },
  { code: "§l", name: "Bold", hex: "#ffffff", isFormat: true },
  { code: "§o", name: "Italic", hex: "#ffffff", isFormat: true },
  { code: "§r", name: "Reset", hex: "#ffffff", isReset: true },
];

function MinecraftMotdLiveBox({ motd, serverName = "Minecraft Server" }: { motd?: string | null; serverName?: string }) {
  const defaultText = "§aRubber Panel §8| §2Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!";
  const raw = (motd || defaultText).replace(/\\n/g, "\n");
  const lines = raw.split("\n");

  const parseLine = (line: string) => {
    const parts = line.split(/(§[0-9a-fk-or])/gi);
    let currentColor = "#ffffff";
    let isBold = false;
    let isItalic = false;

    const colorMap: Record<string, string> = {
      "§0": "#000000", "§1": "#0000aa", "§2": "#00aa00", "§3": "#00aaaa",
      "§4": "#aa0000", "§5": "#aa00aa", "§6": "#ffaa00", "§7": "#aaaaaa",
      "§8": "#555555", "§9": "#5555ff", "§a": "#55ff55", "§b": "#55ffff",
      "§c": "#ff5555", "§d": "#ff55ff", "§e": "#ffff55", "§f": "#ffffff",
    };

    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const lower = part.toLowerCase();

      if (colorMap[lower]) {
        currentColor = colorMap[lower];
      } else if (lower === "§l") {
        isBold = true;
      } else if (lower === "§o") {
        isItalic = true;
      } else if (lower === "§r") {
        currentColor = "#ffffff";
        isBold = false;
        isItalic = false;
      } else if (!part.startsWith("§")) {
        elements.push(
          <span
            key={i}
            style={{
              color: currentColor,
              fontWeight: isBold ? 700 : 400,
              fontStyle: isItalic ? "italic" : "normal",
            }}
          >
            {part}
          </span>
        );
      }
    }

    return elements.length > 0 ? elements : <span>{line}</span>;
  };

  return (
    <div
      className="p-3.5 rounded-xl border font-mono text-xs select-none shadow-md relative overflow-hidden"
      style={{
        backgroundColor: "#0d0d12",
        borderColor: "rgba(163, 230, 53, 0.3)",
      }}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-lime-500/20 border border-lime-500/40 flex items-center justify-center text-[10px] text-lime-400 font-bold shrink-0">
            MC
          </div>
          <span className="font-bold text-zinc-200 text-xs truncate">{serverName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[11px]">
          <span className="text-lime-400 font-semibold">Click to Wake</span>
          <span className="text-zinc-400">0/20</span>
          <div className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 h-1 bg-lime-400 rounded-full" />
            <span className="w-0.5 h-2 bg-lime-400 rounded-full" />
            <span className="w-0.5 h-3 bg-lime-400 rounded-full" />
          </div>
        </div>
      </div>

      <div className="space-y-0.5 min-h-[38px] leading-relaxed">
        {lines.map((ln, idx) => (
          <div key={idx} className="min-h-[18px]">
            {parseLine(ln)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CryoSleepPage() {
  const [activeTab, setActiveTab] = useState<"fleet" | "global" | "nodes">("fleet");
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "SLEEPING" | "ENABLED" | "DISABLED">("ALL");

  // Global Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalSaved, setGlobalSaved] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // Edit Server Modal State
  const [editingServer, setEditingServer] = useState<ServerItem | null>(null);
  const [editForm, setEditForm] = useState({
    enabled: false,
    idleMinutes: 10,
    customMotdAllowed: true,
    motd: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // Action Loading states per server ID
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [serversRes, nodesRes, settingsRes] = await Promise.all([
        fetch("/api/admin/servers?limit=200"),
        fetch("/api/admin/nodes"),
        fetch("/api/admin/settings"),
      ]);

      if (serversRes.ok) {
        const d = await serversRes.json();
        setServers(d.servers || []);
      }

      if (nodesRes.ok) {
        const d = await nodesRes.json();
        setNodes(d.nodes || []);
      }

      if (settingsRes.ok) {
        const d = await settingsRes.json();
        setSettings(d.settings || {});
      }
    } catch (err) {
      console.error("Failed to load Cryo-Sleep data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Global Settings
  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    setGlobalError("");
    setGlobalSaved(false);

    try {
      const payload: Record<string, string> = {
        "cryosleep.defaultEnabled": settings["cryosleep.defaultEnabled"] ?? "false",
        "cryosleep.defaultIdleMinutes": settings["cryosleep.defaultIdleMinutes"] ?? "10",
        "cryosleep.defaultMotd": settings["cryosleep.defaultMotd"] ?? "§aRubber Panel §8| §2Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!",
        "cryosleep.wakeMessage": settings["cryosleep.wakeMessage"] ?? "§a§lRubber Panel §8— §2§lCRYO-SLEEP WAKE-UP\\n\\n§aServer wake sequence initiated!\\n§7The instance is now booting from hibernation.\\n\\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)",
        "cryosleep.allowUserCustomMotd": settings["cryosleep.allowUserCustomMotd"] ?? "true",
        "cryosleep.autoConfigureNewNodes": settings["cryosleep.autoConfigureNewNodes"] ?? "true",
      };

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });

      if (res.ok) {
        setGlobalSaved(true);
        setTimeout(() => setGlobalSaved(false), 3000);
      } else {
        const d = await res.json();
        setGlobalError(d.error || "Failed to save global settings");
      }
    } catch {
      setGlobalError("Network error while saving settings");
    } finally {
      setSavingGlobal(false);
    }
  };

  // Toggle server Cryo-Sleep enabled
  const handleToggleServerEnabled = async (server: ServerItem) => {
    const nextState = !server.cryoSleepEnabled;
    setActionLoading((prev) => ({ ...prev, [server.id]: true }));

    try {
      const res = await fetch(`/api/admin/servers/${server.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryoSleepEnabled: nextState,
        }),
      });

      if (res.ok) {
        setServers((prev) =>
          prev.map((s) => (s.id === server.id ? { ...s, cryoSleepEnabled: nextState } : s))
        );
      }
    } catch (err) {
      console.error("Failed to toggle server Cryo-Sleep:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  // Open Edit Modal for a Server
  const openEditModal = (server: ServerItem) => {
    setEditingServer(server);
    setEditForm({
      enabled: server.cryoSleepEnabled || false,
      idleMinutes: server.cryoSleepIdleMinutes || 10,
      customMotdAllowed: server.cryoSleepCustomMotdAllowed !== false,
      motd: server.cryoSleepMotd || "",
    });
    setEditError("");
    setEditSuccess("");
  };

  // Save Server Modal Changes
  const handleSaveServerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;
    setSavingEdit(true);
    setEditError("");
    setEditSuccess("");

    try {
      const res = await fetch(`/api/admin/servers/${editingServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cryoSleepEnabled: editForm.enabled,
          cryoSleepIdleMinutes: editForm.idleMinutes,
          cryoSleepCustomMotdAllowed: editForm.customMotdAllowed,
          cryoSleepMotd: editForm.motd.trim() || null,
        }),
      });

      if (res.ok) {
        setEditSuccess("Server Cryo-Sleep settings saved successfully!");
        setServers((prev) =>
          prev.map((s) =>
            s.id === editingServer.id
              ? {
                  ...s,
                  cryoSleepEnabled: editForm.enabled,
                  cryoSleepIdleMinutes: editForm.idleMinutes,
                  cryoSleepCustomMotdAllowed: editForm.customMotdAllowed,
                  cryoSleepMotd: editForm.motd.trim() || null,
                }
              : s
          )
        );
        setTimeout(() => {
          setEditingServer(null);
        }, 1200);
      } else {
        const d = await res.json();
        setEditError(d.error || "Failed to update server settings");
      }
    } catch {
      setEditError("Network error while updating server");
    } finally {
      setSavingEdit(false);
    }
  };

  // Reset Server to Global MOTD
  const handleResetToGlobalMotd = async (serverId: string) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      const res = await fetch(`/api/admin/servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cryoSleepMotd: null }),
      });
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, cryoSleepMotd: null } : s))
        );
      }
    } catch (err) {
      console.error("Failed to reset MOTD:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleSleepNow = async (server: ServerItem) => {
    setActionLoading((prev) => ({ ...prev, [server.id]: true }));
    try {
      const res = await fetch(`/api/admin/servers/${server.id}/cryosleep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hibernate", reason: "Admin Panel 1-Click Trigger" }),
      });
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) => (s.id === server.id ? { ...s, isCryoSleeping: true, status: "SLEEPING" } : s))
        );
      }
    } catch (err) {
      console.error("Failed to hibernate:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  const handleWakeNow = async (server: ServerItem) => {
    setActionLoading((prev) => ({ ...prev, [server.id]: true }));
    try {
      const res = await fetch(`/api/admin/servers/${server.id}/cryosleep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wake", trigger: "Admin Panel 1-Click Trigger" }),
      });
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) => (s.id === server.id ? { ...s, isCryoSleeping: false, status: "RUNNING" } : s))
        );
      }
    } catch (err) {
      console.error("Failed to wake:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      const matchSearch =
        search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.owner?.username?.toLowerCase().includes(search.toLowerCase()) ||
        s.owner?.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.node?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.allocations.some((a) => String(a.port).includes(search));

      if (!matchSearch) return false;

      if (filterStatus === "SLEEPING") return s.status === "SLEEPING" || s.isCryoSleeping;
      if (filterStatus === "ENABLED") return s.cryoSleepEnabled;
      if (filterStatus === "DISABLED") return !s.cryoSleepEnabled;
      return true;
    });
  }, [servers, search, filterStatus]);

  // Compute Aggregate Metrics
  const totalEnabled = servers.filter((s) => s.cryoSleepEnabled).length;
  const totalSleeping = servers.filter((s) => s.status === "SLEEPING" || s.isCryoSleeping).length;
  const totalRamSavedMb = servers
    .filter((s) => s.status === "SLEEPING" || s.isCryoSleeping)
    .reduce((sum, s) => sum + s.ram, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: "var(--color-rp-accent-glow)",
                border: "1px solid rgba(163, 230, 53, 0.25)",
                color: "var(--color-rp-accent)",
              }}
            >
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
                  Cryo-Sleep Control &amp; MOTD Hub
                </h1>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                  style={{
                    backgroundColor: "var(--color-rp-accent-glow)",
                    color: "var(--color-rp-accent)",
                    border: "1px solid rgba(163, 230, 53, 0.3)",
                  }}
                >
                  0-RAM Tech
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                Zero-RAM inactivity hibernation, native Minecraft SLP wake proxy engine &amp; per-server MOTD management.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Fleet Coverage
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" }}
            >
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              {totalEnabled} / {servers.length}
            </span>
            <span className="text-xs font-semibold text-lime-400">
              {servers.length > 0 ? Math.round((totalEnabled / servers.length) * 100) : 0}% Active
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Servers configured with auto-hibernation
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Currently Hibernating
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              {totalSleeping}
            </span>
            <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
              <span>Sleeping</span>
              <Moon className="w-3 h-3" />
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Listening with native TCP wake proxies
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              RAM Savings
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "rgba(163, 230, 53, 0.12)", color: "var(--color-rp-accent)" }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              {totalRamSavedMb >= 1024 ? (totalRamSavedMb / 1024).toFixed(1) + " GB" : `${totalRamSavedMb} MB`}
            </span>
            <span className="text-xs font-semibold text-lime-400">0% Memory Mode</span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            RAM reclaimed and freed for new servers
          </p>
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
              Connected Nodes
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <MonitorSpeaker className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              {nodes.filter((n) => n.status === "ONLINE").length} / {nodes.length}
            </span>
            <span className="text-xs text-amber-400 font-semibold">Proxy Ready</span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Heartbeat &amp; SLP daemon synchronized
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
        <button
          type="button"
          onClick={() => setActiveTab("fleet")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "fleet"
              ? "border-lime-400 text-lime-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          style={activeTab === "fleet" ? { borderColor: "var(--color-rp-accent)", color: "var(--color-rp-accent)" } : undefined}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Server Fleet &amp; MOTD Management ({servers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("global")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "global"
              ? "border-lime-400 text-lime-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          style={activeTab === "global" ? { borderColor: "var(--color-rp-accent)", color: "var(--color-rp-accent)" } : undefined}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Global Defaults &amp; Live MOTD Preview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("nodes")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "nodes"
              ? "border-lime-400 text-lime-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          style={activeTab === "nodes" ? { borderColor: "var(--color-rp-accent)", color: "var(--color-rp-accent)" } : undefined}
        >
          <MonitorSpeaker className="w-3.5 h-3.5" />
          <span>Daemon Nodes ({nodes.length})</span>
        </button>
      </div>

      {/* ─── TAB 1: FLEET & MOTD MANAGEMENT ─── */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search server, owner username, email, node or port..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none font-medium"
                style={{
                  backgroundColor: "var(--color-rp-surface-2)",
                  borderColor: "var(--color-rp-border-2)",
                  color: "var(--color-rp-text)",
                }}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-medium text-zinc-400">Filter:</span>
              {(["ALL", "SLEEPING", "ENABLED", "DISABLED"] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setFilterStatus(filterKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterStatus === filterKey
                      ? "bg-lime-400 text-black shadow-sm"
                      : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  style={filterStatus === filterKey ? { backgroundColor: "var(--color-rp-accent)", color: "#000" } : undefined}
                >
                  {filterKey === "ALL" && "All Servers"}
                  {filterKey === "SLEEPING" && "Sleeping Only"}
                  {filterKey === "ENABLED" && "Cryo-Sleep Enabled"}
                  {filterKey === "DISABLED" && "Cryo-Sleep Disabled"}
                </button>
              ))}
            </div>
          </div>

          {/* Servers Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-zinc-900/60 font-semibold" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                  <tr>
                    <th className="py-3 px-4">Server &amp; Port</th>
                    <th className="py-3 px-4">Owner (Who Enabled)</th>
                    <th className="py-3 px-4">Node</th>
                    <th className="py-3 px-4 text-center">Cryo-Sleep Active</th>
                    <th className="py-3 px-4">Current State</th>
                    <th className="py-3 px-4">Inactivity Timeout</th>
                    <th className="py-3 px-4">Active Wake MOTD</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredServers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-zinc-400">
                        No servers found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredServers.map((server) => {
                      const isSleeping = server.status === "SLEEPING" || server.isCryoSleeping;
                      const hasCustomMotd = Boolean(server.cryoSleepMotd);
                      const port = server.allocations?.[0]?.port || 25565;

                      return (
                        <tr key={server.id} className="hover:bg-zinc-900/30 transition-colors">
                          {/* Server & Port */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: server.cryoSleepEnabled
                                    ? "var(--color-rp-accent-glow)"
                                    : "rgba(255, 255, 255, 0.05)",
                                  color: server.cryoSleepEnabled ? "var(--color-rp-accent)" : "var(--color-rp-text-muted)",
                                }}
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <Link
                                  href={`/servers/${server.id}`}
                                  className="font-bold text-xs hover:underline flex items-center gap-1"
                                  style={{ color: "var(--color-rp-text)" }}
                                >
                                  {server.name}
                                </Link>
                                <div className="text-[11px] font-mono text-zinc-500">
                                  Port :{port} · {server.ram} MB
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Owner */}
                          <td className="py-3.5 px-4">
                            {server.owner ? (
                              <div>
                                <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                                  <Users className="w-3 h-3 text-zinc-500" />
                                  <span>{server.owner.username}</span>
                                </div>
                                <div className="text-[10.5px] text-zinc-500">{server.owner.email}</div>
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic">No owner</span>
                            )}
                          </td>

                          {/* Node */}
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 font-medium text-[11px]">
                              {server.node?.name || "Local Node"}
                            </span>
                          </td>

                          {/* Cryo-Sleep Enabled Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleServerEnabled(server)}
                              disabled={actionLoading[server.id]}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                server.cryoSleepEnabled ? "bg-lime-400" : "bg-zinc-700"
                              }`}
                              style={server.cryoSleepEnabled ? { backgroundColor: "var(--color-rp-accent)" } : undefined}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  server.cryoSleepEnabled ? "translate-x-4" : "translate-x-0 bg-white"
                                }`}
                              />
                            </button>
                          </td>

                          {/* Current State */}
                          <td className="py-3.5 px-4">
                            {isSleeping ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px]"
                                style={{
                                  backgroundColor: "var(--color-rp-accent-glow)",
                                  color: "var(--color-rp-accent)",
                                  border: "1px solid rgba(163, 230, 53, 0.3)",
                                }}
                              >
                                <Moon className="w-3 h-3 text-lime-400" />
                                <span>Sleeping (0% RAM)</span>
                              </span>
                            ) : server.status === "RUNNING" ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[11px]">
                                Offline
                              </span>
                            )}
                          </td>

                          {/* Inactivity Timeout */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-zinc-300">
                              {server.cryoSleepIdleMinutes || 10}m
                            </span>
                          </td>

                          {/* Active MOTD snippet */}
                          <td className="py-3.5 px-4 max-w-[260px]">
                            <div className="truncate">
                              {hasCustomMotd ? (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(server)}
                                  className="text-left font-mono text-[11px] hover:underline flex items-center gap-1 max-w-full truncate"
                                  style={{ color: "var(--color-rp-accent)" }}
                                  title={server.cryoSleepMotd || ""}
                                >
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-lime-500/15 text-lime-400 border border-lime-500/30 shrink-0">
                                    Custom
                                  </span>
                                  <span className="truncate">{server.cryoSleepMotd?.replace(/§[0-9a-fk-or]/gi, "")}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(server)}
                                  className="text-left text-zinc-400 hover:text-zinc-200 font-mono text-[11px] hover:underline flex items-center gap-1 max-w-full truncate"
                                  title={settings["cryosleep.defaultMotd"] || "Global default MOTD"}
                                >
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 shrink-0">
                                    Global
                                  </span>
                                  <span className="truncate">{settings["cryosleep.defaultMotd"]?.replace(/§[0-9a-fk-or]/gi, "") || "Rubber Panel Cryo-Sleep"}</span>
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                              {server.cryoSleepCustomMotdAllowed !== false ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> User Allowed
                                </span>
                              ) : (
                                <span className="text-amber-400 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Admin Locked
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click Sleep / Wake Buttons */}
                              {isSleeping ? (
                                <button
                                  type="button"
                                  onClick={() => handleWakeNow(server)}
                                  disabled={actionLoading[server.id]}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                                  title="Wake server immediately from Cryo-Sleep"
                                >
                                  <Zap className="w-3 h-3" />
                                  <span>Wake</span>
                                </button>
                              ) : server.cryoSleepEnabled ? (
                                <button
                                  type="button"
                                  onClick={() => handleSleepNow(server)}
                                  disabled={actionLoading[server.id]}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-lime-500/15 text-lime-400 border border-lime-500/30 hover:bg-lime-500/25 transition-all"
                                  title="Put server into Cryo-Sleep (0% RAM mode) & start wake proxy"
                                >
                                  <Moon className="w-3 h-3" />
                                  <span>Sleep</span>
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => openEditModal(server)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all"
                                title="Edit MOTD & Cryo-Sleep Configuration"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {hasCustomMotd && (
                                <button
                                  type="button"
                                  onClick={() => handleResetToGlobalMotd(server.id)}
                                  disabled={actionLoading[server.id]}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-all"
                                  title="Reset to Global Default MOTD"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB 2: GLOBAL DEFAULTS & LIVE PREVIEW ─── */}
      {activeTab === "global" && (
        <form onSubmit={handleSaveGlobal} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Settings */}
            <div className="lg:col-span-7 space-y-5">
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-rp-text)" }}>
                  Global Provisioning Policy
                </h3>

                <div className="space-y-4">
                  <Toggle
                    checked={settings["cryosleep.defaultEnabled"] === "true"}
                    onChange={() =>
                      setSettings((s) => ({
                        ...s,
                        "cryosleep.defaultEnabled": s["cryosleep.defaultEnabled"] === "true" ? "false" : "true",
                      }))
                    }
                    label="Enable Cryo-Sleep by Default on Newly Created Servers"
                    description="When checked, every newly provisioned server will start with Cryo-Sleep enabled."
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <Input
                      label="Default Idle Timeout (Minutes)"
                      type="number"
                      value={settings["cryosleep.defaultIdleMinutes"] ?? "10"}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, "cryosleep.defaultIdleMinutes": e.target.value }))
                      }
                      hint="Minutes with 0 players online before hibernation."
                    />

                    <Toggle
                      checked={settings["cryosleep.allowUserCustomMotd"] !== "false"}
                      onChange={() =>
                        setSettings((s) => ({
                          ...s,
                          "cryosleep.allowUserCustomMotd":
                            s["cryosleep.allowUserCustomMotd"] === "false" ? "true" : "false",
                        }))
                      }
                      label="Allow Users to Customize Wake MOTD"
                      description="Permit server owners to edit their server MOTD in User Panel."
                    />
                  </div>

                  <Toggle
                    checked={settings["cryosleep.autoConfigureNewNodes"] !== "false"}
                    onChange={() =>
                      setSettings((s) => ({
                        ...s,
                        "cryosleep.autoConfigureNewNodes":
                          s["cryosleep.autoConfigureNewNodes"] === "false" ? "true" : "false",
                      }))
                    }
                    label="Auto-Configure Cryo-Sleep Engine on New Nodes"
                    description="Automatically synchronize TCP wake proxy and monitoring daemon to newly added nodes."
                  />
                </div>
              </Card>

              {/* Global MOTD Editor */}
              <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                    Global Default Cryo-Sleep MOTD
                  </h3>
                  <span className="text-[11px] text-zinc-400">Minecraft Color Codes (`§`)</span>
                </div>

                <div className="space-y-3">
                  {/* Click to Insert Minecraft Color Code Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <span className="text-[10.5px] font-semibold text-zinc-400 mr-1">Insert Color:</span>
                    {MINECRAFT_COLORS.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          const cur = settings["cryosleep.defaultMotd"] ?? "";
                          setSettings((s) => ({ ...s, "cryosleep.defaultMotd": cur + c.code }));
                        }}
                        className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold transition-transform hover:scale-105"
                        style={{
                          backgroundColor: c.bg || "rgba(255,255,255,0.1)",
                          color: c.code === "§0" ? "#aaaaaa" : c.hex,
                          border: `1px solid ${c.hex}40`,
                        }}
                        title={`${c.name} (${c.code})`}
                      >
                        {c.code}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const cur = settings["cryosleep.defaultMotd"] ?? "";
                        setSettings((s) => ({ ...s, "cryosleep.defaultMotd": cur + "\\n" }));
                      }}
                      className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                      title="Insert Newline"
                    >
                      \n (Newline)
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={
                      settings["cryosleep.defaultMotd"] ??
                      "§aRubber Panel §8| §2Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!"
                    }
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, "cryosleep.defaultMotd": e.target.value }))
                    }
                    className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
                    style={{
                      backgroundColor: "var(--color-rp-surface-2)",
                      borderColor: "var(--color-rp-border-2)",
                      color: "var(--color-rp-text)",
                    }}
                  />
                  <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                    Displayed on player multiplayer server list pings when server is sleeping. Supports 2 lines separated by <code>\n</code>.
                  </p>
                </div>
              </Card>

              {/* Wake Kick Screen */}
              <Card padding="md">
                <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-rp-text)" }}>
                  Auto-Wake Kick Screen Message (Login Handshake)
                </h3>
                <textarea
                  rows={3}
                  value={
                    settings["cryosleep.wakeMessage"] ??
                    "§a§lRubber Panel §8— §2§lCRYO-SLEEP WAKE-UP\\n\\n§aServer wake sequence initiated!\\n§7The instance is now booting from hibernation.\\n\\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)"
                  }
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, "cryosleep.wakeMessage": e.target.value }))
                  }
                  className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border-2)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </Card>
            </div>

            {/* Right Column: Real-Time Live Preview */}
            <div className="lg:col-span-5 space-y-4">
              <Card padding="md">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-lime-400" />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                    Multiplayer List Live Preview
                  </h3>
                </div>

                <p className="text-xs text-zinc-400 mb-3">
                  This is how players see sleeping servers in their Minecraft Multiplayer menu:
                </p>

                <MinecraftMotdLiveBox
                  motd={settings["cryosleep.defaultMotd"]}
                  serverName="Rubber Panel SMP (Cryo-Sleeping)"
                />

                <div
                  className="mt-4 p-3 rounded-lg border text-xs leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-rp-accent-glow)",
                    borderColor: "rgba(163, 230, 53, 0.25)",
                    color: "var(--color-rp-text)",
                  }}
                >
                  <span className="font-bold text-lime-400 inline-flex items-center gap-1" style={{ color: "var(--color-rp-accent)" }}>
                    <Info className="w-3.5 h-3.5" />
                    <span>Auto-Wake Mechanics:</span>
                  </span>{" "}
                  When a player double-clicks to connect, the proxy catches the login handshake, instantly starts the server, returns the wake kick splash, and releases port <code>:25565</code> so Minecraft can boot cleanly.
                </div>
              </Card>

              {globalError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{globalError}</span>
                </div>
              )}

              {globalSaved && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Global Cryo-Sleep settings and defaults saved!</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={savingGlobal}
                className="w-full flex items-center justify-center gap-2 h-10 font-bold text-xs"
                style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
              >
                {savingGlobal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{savingGlobal ? "Saving..." : "Save Global Settings"}</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ─── TAB 3: NODE DAEMONS STATUS ─── */}
      {activeTab === "nodes" && (
        <div className="space-y-4">
          <Card padding="none">
            <div className="p-4 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                Cluster Node Daemons &amp; Proxy Readiness
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Nodes automatically initialize the native Node.js TCP wake proxy daemon on boot and heartbeat.
              </p>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {nodes.map((node) => {
                const nodeServers = servers.filter((s) => s.node?.id === node.id || s.node?.name === node.name);
                const sleepingOnNode = nodeServers.filter((s) => s.status === "SLEEPING" || s.isCryoSleeping).length;

                return (
                  <div key={node.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center font-bold"
                        style={{ color: "var(--color-rp-accent)" }}
                      >
                        <MonitorSpeaker className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-100">{node.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              node.status === "ONLINE"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {node.status}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-zinc-400 mt-0.5">
                          {node.fqdn}:{node.port} · Agent v{node.agentVersion || "1.0.0"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs">
                      <div>
                        <div className="text-zinc-500 font-medium">Servers on Node</div>
                        <div className="font-bold text-zinc-200 mt-0.5">{nodeServers.length} servers</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 font-medium">Active Wake Proxies</div>
                        <div className="font-bold text-lime-400 mt-0.5" style={{ color: "var(--color-rp-accent)" }}>
                          {sleepingOnNode} proxies active
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 font-medium">Heartbeat Sync</div>
                        <div className="text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Auto-Configured</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ─── MODAL: EDIT SERVER CRYO-SLEEP & MOTD ─── */}
      {editingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-rp-border)" }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" }}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                    Manage Cryo-Sleep &amp; MOTD: {editingServer.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Owner: {editingServer.owner?.username || "Admin"} ({editingServer.owner?.email || "N/A"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingServer(null)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveServerEdit} className="p-6 space-y-4 overflow-y-auto">
              <Toggle
                checked={editForm.enabled}
                onChange={() => setEditForm((f) => ({ ...f, enabled: !f.enabled }))}
                label="Enable Cryo-Sleep for this Instance"
                description="Instance will automatically hibernate to 0% RAM when empty."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--color-rp-text)" }}>
                    Idle Timeout (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={editForm.idleMinutes}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, idleMinutes: parseInt(e.target.value) || 10 }))
                    }
                    className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                    style={{
                      backgroundColor: "var(--color-rp-surface-2)",
                      borderColor: "var(--color-rp-border-2)",
                      color: "var(--color-rp-text)",
                    }}
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Minutes with 0 players before sleeping</p>
                </div>

                <div className="pt-2">
                  <Toggle
                    checked={editForm.customMotdAllowed}
                    onChange={() =>
                      setEditForm((f) => ({ ...f, customMotdAllowed: !f.customMotdAllowed }))
                    }
                    label="Allow User Custom MOTD"
                    description="Permits owner to override this server's MOTD in User Panel."
                  />
                </div>
              </div>

              {/* Custom MOTD Input */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
                    Custom MOTD Override (Optional)
                  </label>
                  {editForm.motd && (
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, motd: "" }))}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Clear &amp; Revert to Global Default
                    </button>
                  )}
                </div>

                {/* Color chips */}
                <div className="flex items-center gap-1 flex-wrap p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 mr-1">Insert:</span>
                  {MINECRAFT_COLORS.slice(0, 16).map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, motd: f.motd + c.code }))}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                      style={{
                        backgroundColor: c.bg || "#000",
                        color: c.code === "§0" ? "#aaaaaa" : c.hex,
                        border: `1px solid ${c.hex}40`,
                      }}
                    >
                      {c.code}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, motd: f.motd + "\\n" }))}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300"
                  >
                    \n
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={editForm.motd}
                  onChange={(e) => setEditForm((f) => ({ ...f, motd: e.target.value }))}
                  placeholder="Leave empty to use global default Rubber Panel MOTD"
                  className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border-2)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>

              {/* Live Preview */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">Live Multiplayer Preview:</label>
                <MinecraftMotdLiveBox motd={editForm.motd} serverName={editingServer.name} />
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400">
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400">
                  {editSuccess}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingServer(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit}
                  size="sm"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
