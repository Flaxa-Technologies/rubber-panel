"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, RefreshCw, Plus, Server, X, Loader2, Play, Square,
  RotateCcw, ChevronLeft, ChevronRight, Trash2, Pencil,
  HardDrive, Cpu, Network, Shield, Upload, Check, Filter, User, Lock, FolderOpen,
  ExternalLink, Terminal, ArrowLeftRight, Zap, ShieldAlert, FastForward,
  Calendar, Clock, Cloud, Coffee, Sparkles, Box, Gamepad2, Code, Database, Globe, Download, Flame, Star
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/Badge";

interface JavaVersion {
  id: string;
  name: string;
  version: string;
  dockerImage?: string | null;
  binaryPath?: string | null;
  isDefault: boolean;
  nodeId?: string | null;
  node?: { id: string; name: string } | null;
  description?: string | null;
  _count?: { servers: number };
}

interface ContainerImage {
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
  node?: { id: string; name: string } | null;
  isOfficial: boolean;
  isPulled: boolean;
}

interface ServerItem {
  id: string;
  name: string;
  uuid: string;
  status: string;
  suspended: boolean;
  ram: number;
  cpu: number;
  disk: number;
  createdAt: string;
  owner: { username: string; email: string } | null;
  node: { name: string; status: string } | null;
  software: { name: string; type: string } | null;
  allocations: { ip: string; port: number }[];
  allowNodeTransfer?: boolean;
  cryoSleepEnabled?: boolean;
  cryoSleepIdleMinutes?: number;
  cryoSleepCustomMotdAllowed?: boolean;
  cryoSleepMotd?: string | null;
  serverType?: string;
  nodeVersion?: string | null;
  securityProtection?: boolean;
  securitySuspendedUntil?: string | null;
  securityQuarantineReason?: string | null;
  javaVersion?: string | null;
  javaVersionId?: string | null;
  customImageId?: string | null;
  customImage?: { id: string; name: string; dockerImage: string; icon?: string | null; category: string } | null;
  expiresAt?: string | null;
  gracePeriodDays?: number;
  autoSuspendOnExpiry?: boolean;
  autoDeleteOnGraceExpiry?: boolean;
  suspensionReason?: string | null;
}

interface Node { id: string; name: string; fqdn: string; status?: string; isOnline?: boolean; portRangeStart?: number; portRangeEnd?: number; }
interface User { id: string; username: string; email: string; }
interface Alloc { id: string; ip: string; port: number; }
interface SoftwareVersion { id: string; version: string; isStable: boolean; }
interface Software { id: string; name: string; type: string; versions: SoftwareVersion[]; }
interface Template { id: string; name: string; dockerImage?: string; startupCmd?: string; }

const PAGE_SIZE = 20;

// Wizard step order: Details → Resources → Software → Networking → Permissions → Billing
const STEPS = [
  { label: "Details",     icon: Server    },
  { label: "Resources",   icon: Cpu       },
  { label: "Software",    icon: HardDrive },
  { label: "Networking",  icon: Network   },
  { label: "Permissions", icon: Shield    },
  { label: "Billing",     icon: Calendar  },
];

const EMPTY_FORM = {
  // Step 0: Details
  name: "", ownerId: "", nodeId: "",
  serverType: "MINECRAFT", // "MINECRAFT" | "NODEJS" | "CUSTOM"
  customImageId: "",
  // Step 1: Resources
  ram: "1024", cpu: "100", disk: "5120", swap: "0",
  // Step 2: Software & Runtimes
  softwareId: "", softwareVersionId: "", templateId: "",
  nodeVersion: "20",       // "18" | "20" | "22" | "23"
  javaVersion: "21",
  javaVersionId: "",
  showStableOnly: false,   // toggle — OFF by default (shows ALL versions)
  startupCommand: "",      // auto-populated from RAM; editable
  // Step 3: Networking
  allocationId: "",
  portCount: "1",          // how many total ports to allocate
  specificPorts: "",       // optional comma-separated list of explicit port numbers
  // Step 4: Permissions & Security Shield & Cryo-Sleep
  allowFileUploads: true,
  securityProtection: true,// Malicious child_process & payload download scanner
  cryoSleepEnabled: false,
  cryoSleepIdleMinutes: "10",
  cryoSleepCustomMotdAllowed: true,
  cryoSleepMotd: "",
  allowedPaths: "/",
  protectedPaths: "",
  blockedUploadPaths: "",
  allowNodeTransfer: false,
  allowGoogleDriveBackups: true,
  // Step 5: Billing & Lifecycle
  expiresAt: "",
  gracePeriodDays: "3",
  autoSuspendOnExpiry: true,
  autoDeleteOnGraceExpiry: false,
};

const fieldStyle = {
  backgroundColor: "var(--color-rp-surface-2)",
  borderColor: "var(--color-rp-border-2)",
  color: "var(--color-rp-text)",
};

function ToggleSwitch({
  checked,
  onChange,
  activeColor = "var(--color-rp-accent)",
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  activeColor?: string;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  const pillWidth = isSm ? 38 : 44;
  const pillHeight = isSm ? 22 : 24;
  const knobSize = isSm ? 16 : 18;
  const offset = isSm ? (checked ? 19 : 3) : (checked ? 23 : 3);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="shrink-0 relative rounded-full transition-all duration-200 ease-out focus:outline-none cursor-pointer select-none"
      style={{
        width: `${pillWidth}px`,
        height: `${pillHeight}px`,
        backgroundColor: checked ? activeColor : "rgba(255, 255, 255, 0.15)",
        boxShadow: checked ? `0 0 10px ${activeColor}40` : "none",
      }}
    >
      <span
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white transition-all duration-200 ease-out shadow-sm"
        style={{
          width: `${knobSize}px`,
          height: `${knobSize}px`,
          left: `${offset}px`,
        }}
      />
    </button>
  );
}

function ServersPageContent() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<Alloc[]>([]);
  const [softwareList, setSoftwareList] = useState<Software[]>([]);
  const [templatesList, setTemplatesList] = useState<Template[]>([]);
  const [javaVersions, setJavaVersions] = useState<JavaVersion[]>([]);
  const [containerImages, setContainerImages] = useState<ContainerImage[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [syncing, setSyncing] = useState(false);

  // ─── Java Environments Manager State ───────────────────────────────────────
  const [showJavaModal, setShowJavaModal] = useState(false);
  const [editingJavaVersion, setEditingJavaVersion] = useState<JavaVersion | null>(null);
  const [javaForm, setJavaForm] = useState({
    name: "", version: "21", dockerImage: "", binaryPath: "java", isDefault: false, nodeId: "", description: "",
  });
  const [savingJava, setSavingJava] = useState(false);
  const [javaModalError, setJavaModalError] = useState("");
  const [deletingJavaId, setDeletingJavaId] = useState<string | null>(null);

  const [deleteServerId, setDeleteServerId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Edit State ───────────────────────────────────────────────────────────
  const [editServer, setEditServer] = useState<ServerItem | null>(null);
  const [editAllocations, setEditAllocations] = useState<any[]>([]);
  const [nodeFreeAllocations, setNodeFreeAllocations] = useState<any[]>([]);
  const [customPortInput, setCustomPortInput] = useState("");
  const [editForm, setEditForm] = useState({
    name: "", ownerId: "", softwareId: "", softwareVersionId: "",
    serverType: "MINECRAFT", nodeVersion: "20", securityProtection: true,
    javaVersion: "21", javaVersionId: "",
    ram: "", cpu: "", disk: "", swap: "", startupCommand: "",
    allowedPaths: "", protectedPaths: "", blockedUploadPaths: "", allowFileUploads: true,
    showStableOnly: false, allowNodeTransfer: false, allowGoogleDriveBackups: true,
    cryoSleepEnabled: false, cryoSleepIdleMinutes: "10", cryoSleepCustomMotdAllowed: true, cryoSleepMotd: "",
    expiresAt: "", gracePeriodDays: "3", autoSuspendOnExpiry: true, autoDeleteOnGraceExpiry: false,
    suspensionReason: "",
  });
  const [editStep, setEditStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // ─── Admin Node Transfer State ────────────────────────────────────────────
  const [transferServer, setTransferServer] = useState<ServerItem | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferNodes, setTransferNodes] = useState<any[]>([]);
  const [transferTargetNodeId, setTransferTargetNodeId] = useState("");
  const [transferTargetAllocId, setTransferTargetAllocId] = useState("");
  const [transferExcludeLogs, setTransferExcludeLogs] = useState(true);
  const [transferExcludeBackups, setTransferExcludeBackups] = useState(true);
  const [transferExcludeCache, setTransferExcludeCache] = useState(true);
  const [transferPreStop, setTransferPreStop] = useState(true);
  const [transferAutoStart, setTransferAutoStart] = useState(true);
  const [transferCleanup, setTransferCleanup] = useState(true);
  const [transferSpeedMbps, setTransferSpeedMbps] = useState("0");
  const [transferActive, setTransferActive] = useState<any>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState("");

  const EDIT_STEPS = [
    { label: "Details",     icon: Server    },
    { label: "Resources",   icon: Cpu       },
    { label: "Network",     icon: Network   },
    { label: "Software",    icon: HardDrive },
    { label: "Permissions", icon: Shield    },
    { label: "Billing",     icon: Calendar  },
  ];

  async function openEdit(server: ServerItem) {
    setEditServer(server);
    setEditStep(0);
    setEditError("");
    setCustomPortInput("");
    // Load full server details and node allocations
    try {
      const [serverRes, userRes, swRes, jvRes] = await Promise.all([
        fetch(`/api/admin/servers/${server.id}`),
        fetch("/api/admin/users?limit=100"),
        fetch("/api/admin/software"),
        fetch("/api/admin/java-versions"),
      ]);
      if (userRes.ok) setUsers((await userRes.json()).users ?? []);
      if (swRes.ok) setSoftwareList((await swRes.json()).software ?? []);
      if (jvRes.ok) setJavaVersions((await jvRes.json()).javaVersions ?? []);
      if (serverRes.ok) {
        const s = await serverRes.json();
        setEditAllocations(s.allocations || []);
        
        // Fetch allocations on server's node
        const nId = s.node?.id || server.node?.name;
        if (s.node?.id) {
          const aRes = await fetch(`/api/admin/allocations?nodeId=${s.node.id}&limit=200`);
          if (aRes.ok) {
            const allAllocs = (await aRes.json()).allocations || [];
            setNodeFreeAllocations(allAllocs.filter((a: any) => !a.assigned || a.serverId === server.id));
          }
        }

        let allowedArr: string[] = [];
        let protectedArr: string[] = [];
        let blockedUploadArr: string[] = [];
        try { allowedArr = JSON.parse(s.allowedPaths || "[]"); } catch {}
        try { protectedArr = JSON.parse(s.protectedPaths || "[]"); } catch {}
        try { blockedUploadArr = JSON.parse(s.blockedUploadPaths || "[]"); } catch {}
        setEditForm({
          name: s.name ?? "",
          ownerId: s.owner?.id ?? "",
          serverType: s.serverType || "MINECRAFT",
          nodeVersion: s.nodeVersion || "20",
          securityProtection: s.securityProtection !== false,
          softwareId: s.softwareId ?? "",
          softwareVersionId: s.softwareVersionId ?? "",
          javaVersion: s.javaVersion || "21",
          javaVersionId: s.javaVersionId || "",
          ram: String(s.ram ?? "1024"),
          cpu: String(s.cpu ?? "100"),
          disk: String(s.disk ?? "5120"),
          swap: String(s.swap ?? "0"),
          startupCommand: s.startupCommand ?? "",
          allowedPaths: allowedArr.join(", "),
          protectedPaths: protectedArr.join(", "),
          blockedUploadPaths: blockedUploadArr.join(", "),
          allowFileUploads: true,
          showStableOnly: false,
          allowNodeTransfer: Boolean(s.allowNodeTransfer),
          allowGoogleDriveBackups: s.allowGoogleDriveBackups !== false,
          cryoSleepEnabled: Boolean(s.cryoSleepEnabled),
          cryoSleepIdleMinutes: String(s.cryoSleepIdleMinutes ?? 10),
          cryoSleepCustomMotdAllowed: s.cryoSleepCustomMotdAllowed !== false,
          cryoSleepMotd: s.cryoSleepMotd ?? "",
          expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString().split("T")[0] : "",
          gracePeriodDays: String(s.gracePeriodDays ?? 3),
          autoSuspendOnExpiry: s.autoSuspendOnExpiry !== false,
          autoDeleteOnGraceExpiry: Boolean(s.autoDeleteOnGraceExpiry),
          suspensionReason: s.suspensionReason ?? "",
        });
      }
    } catch { setEditError("Failed to load server details."); }
  }

  async function assignPortToEditServer(allocId: string) {
    if (!editServer) return;
    try {
      const res = await fetch(`/api/admin/servers/${editServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignAllocationId: allocId }),
      });
      if (res.ok) {
        const s = await (await fetch(`/api/admin/servers/${editServer.id}`)).json();
        setEditAllocations(s.allocations || []);
        if (s.node?.id) {
          const allAllocs = (await (await fetch(`/api/admin/allocations?nodeId=${s.node.id}&limit=200`)).json()).allocations || [];
          setNodeFreeAllocations(allAllocs.filter((a: any) => !a.assigned));
        }
        await load();
      }
    } catch {}
  }

  async function unassignPortFromEditServer(allocId: string) {
    if (!editServer) return;
    try {
      const res = await fetch(`/api/admin/servers/${editServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unassignAllocationId: allocId }),
      });
      if (res.ok) {
        const s = await (await fetch(`/api/admin/servers/${editServer.id}`)).json();
        setEditAllocations(s.allocations || []);
        if (s.node?.id) {
          const allAllocs = (await (await fetch(`/api/admin/allocations?nodeId=${s.node.id}&limit=200`)).json()).allocations || [];
          setNodeFreeAllocations(allAllocs.filter((a: any) => !a.assigned));
        }
        await load();
      }
    } catch {}
  }

  async function createAndAssignCustomPort() {
    if (!editServer || !customPortInput) return;
    const portNum = parseInt(customPortInput);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setEditError("Port must be a valid number between 1024 and 65535");
      return;
    }
    try {
      const res = await fetch(`/api/admin/servers/${editServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createAndAssignPort: portNum }),
      });
      if (res.ok) {
        setCustomPortInput("");
        const s = await (await fetch(`/api/admin/servers/${editServer.id}`)).json();
        setEditAllocations(s.allocations || []);
        if (s.node?.id) {
          const allAllocs = (await (await fetch(`/api/admin/allocations?nodeId=${s.node.id}&limit=200`)).json()).allocations || [];
          setNodeFreeAllocations(allAllocs.filter((a: any) => !a.assigned));
        }
        await load();
      }
    } catch {}
  }

  // ─── Admin Quick Port Manager State ───────────────────────────────────────
  const [portModalServer, setPortModalServer] = useState<ServerItem | null>(null);
  const [portModalAllocations, setPortModalAllocations] = useState<any[]>([]);
  const [portModalFreeAllocations, setPortModalFreeAllocations] = useState<any[]>([]);
  const [portModalCustomPort, setPortModalCustomPort] = useState("");
  const [portModalLoading, setPortModalLoading] = useState(false);
  const [portModalActionLoading, setPortModalActionLoading] = useState(false);
  const [portModalError, setPortModalError] = useState("");
  const [portModalSuccess, setPortModalSuccess] = useState("");

  async function openPortModal(server: ServerItem) {
    setPortModalServer(server);
    setPortModalError("");
    setPortModalSuccess("");
    setPortModalCustomPort("");
    setPortModalLoading(true);
    try {
      const serverRes = await fetch(`/api/admin/servers/${server.id}`);
      if (serverRes.ok) {
        const s = await serverRes.json();
        setPortModalAllocations(s.allocations || []);
        if (s.node?.id) {
          const aRes = await fetch(`/api/admin/allocations?nodeId=${s.node.id}&limit=200`);
          if (aRes.ok) {
            const allAllocs = (await aRes.json()).allocations || [];
            setPortModalFreeAllocations(allAllocs.filter((a: any) => !a.assigned));
          }
        }
      }
    } catch {
      setPortModalError("Failed to load server port allocations.");
    }
    setPortModalLoading(false);
  }

  async function quickAssignNextFreePort(count: number = 1) {
    if (!portModalServer) return;
    setPortModalActionLoading(true);
    setPortModalError("");
    setPortModalSuccess("");
    try {
      const res = await fetch(`/api/admin/servers/${portModalServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignExtraPortsCount: count }),
      });
      if (res.ok) {
        setPortModalSuccess(`Successfully gave +${count} extra port${count > 1 ? "s" : ""} to ${portModalServer.name}!`);
        await openPortModal(portModalServer);
        await load();
      } else {
        const d = await res.json();
        setPortModalError(d.error || "Failed to allocate extra port.");
      }
    } catch {
      setPortModalError("Network error while adding port.");
    }
    setPortModalActionLoading(false);
  }

  async function quickAssignSpecificPort(allocId: string) {
    if (!portModalServer) return;
    setPortModalActionLoading(true);
    setPortModalError("");
    setPortModalSuccess("");
    try {
      const res = await fetch(`/api/admin/servers/${portModalServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignAllocationId: allocId }),
      });
      if (res.ok) {
        setPortModalSuccess("Port assigned successfully!");
        await openPortModal(portModalServer);
        await load();
      } else {
        const d = await res.json();
        setPortModalError(d.error || "Failed to assign port.");
      }
    } catch {
      setPortModalError("Network error while assigning port.");
    }
    setPortModalActionLoading(false);
  }

  async function quickCreateAndAssignCustomPort() {
    if (!portModalServer || !portModalCustomPort) return;
    const portNum = parseInt(portModalCustomPort);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setPortModalError("Port must be a valid number between 1024 and 65535");
      return;
    }
    setPortModalActionLoading(true);
    setPortModalError("");
    setPortModalSuccess("");
    try {
      const res = await fetch(`/api/admin/servers/${portModalServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createAndAssignPort: portNum }),
      });
      if (res.ok) {
        setPortModalCustomPort("");
        setPortModalSuccess(`Port :${portNum} created and assigned to ${portModalServer.name}!`);
        await openPortModal(portModalServer);
        await load();
      } else {
        const d = await res.json();
        setPortModalError(d.error || "Failed to bind custom port.");
      }
    } catch {
      setPortModalError("Network error while creating port.");
    }
    setPortModalActionLoading(false);
  }

  async function quickUnassignPort(allocId: string) {
    if (!portModalServer) return;
    setPortModalActionLoading(true);
    setPortModalError("");
    setPortModalSuccess("");
    try {
      const res = await fetch(`/api/admin/servers/${portModalServer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unassignAllocationId: allocId }),
      });
      if (res.ok) {
        setPortModalSuccess("Port unassigned and returned to node pool.");
        await openPortModal(portModalServer);
        await load();
      } else {
        const d = await res.json();
        setPortModalError(d.error || "Failed to unassign port.");
      }
    } catch {
      setPortModalError("Network error while unassigning port.");
    }
    setPortModalActionLoading(false);
  }

  async function saveEdit() {
    if (!editServer) return;
    setSaving(true); setEditError("");
    const res = await fetch(`/api/admin/servers/${editServer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        ownerId: editForm.ownerId || undefined,
        serverType: editForm.serverType,
        nodeVersion: editForm.nodeVersion,
        securityProtection: editForm.securityProtection !== false,
        softwareId: editForm.softwareId || undefined,
        softwareVersionId: editForm.softwareVersionId || undefined,
        javaVersion: editForm.javaVersion,
        javaVersionId: editForm.javaVersionId || undefined,
        ram: parseInt(editForm.ram),
        cpu: parseInt(editForm.cpu),
        disk: parseInt(editForm.disk),
        swap: parseInt(editForm.swap) || 0,
        startupCommand: editForm.startupCommand || undefined,
        allowedPaths: editForm.allowedPaths.split(",").map(p => p.trim()).filter(Boolean),
        protectedPaths: editForm.protectedPaths.split(",").map(p => p.trim()).filter(Boolean),
        blockedUploadPaths: editForm.blockedUploadPaths.split(",").map(p => p.trim()).filter(Boolean),
        allowNodeTransfer: editForm.allowNodeTransfer,
        allowGoogleDriveBackups: editForm.allowGoogleDriveBackups,
        cryoSleepEnabled: editForm.cryoSleepEnabled,
        cryoSleepIdleMinutes: parseInt(editForm.cryoSleepIdleMinutes) || 10,
        cryoSleepCustomMotdAllowed: editForm.cryoSleepCustomMotdAllowed,
        cryoSleepMotd: editForm.cryoSleepMotd || null,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
        gracePeriodDays: parseInt(editForm.gracePeriodDays) || 0,
        autoSuspendOnExpiry: editForm.autoSuspendOnExpiry,
        autoDeleteOnGraceExpiry: editForm.autoDeleteOnGraceExpiry,
        suspensionReason: editForm.suspensionReason || null,
      }),
    });
    if (res.ok) { setEditServer(null); await load(); }
    else { const d = await res.json(); setEditError(d.error ?? "Failed to save"); }
    setSaving(false);
  }

  async function openTransferModal(server: ServerItem) {
    setTransferServer(server);
    setTransferLoading(true);
    setTransferError("");
    setTransferTargetNodeId("");
    setTransferTargetAllocId("");
    try {
      const res = await fetch(`/api/admin/servers/${server.id}/transfer`);
      if (res.ok) {
        const data = await res.json();
        const otherNodes = (data.availableNodes || []).filter((n: any) => n.id !== server.node?.name && n.id !== data.server?.nodeId);
        setTransferNodes(otherNodes);
        setTransferActive(data.activeTransfer);
        if (otherNodes.length > 0) {
          setTransferTargetNodeId(otherNodes[0].id);
          if (otherNodes[0].allocations?.length > 0) {
            setTransferTargetAllocId(otherNodes[0].allocations[0].id);
          }
        }
      } else {
        setTransferError("Failed to fetch transfer options.");
      }
    } catch {
      setTransferError("Network error fetching transfer options.");
    }
    setTransferLoading(false);
  }

  async function executeAdminTransfer() {
    if (!transferServer || !transferTargetNodeId) return;
    setTransferSubmitting(true);
    setTransferError("");

    const excludePaths: string[] = [];
    if (transferExcludeLogs) excludePaths.push("logs");
    if (transferExcludeBackups) excludePaths.push("backups");
    if (transferExcludeCache) {
      excludePaths.push(".cache");
      excludePaths.push("cache");
    }

    try {
      const res = await fetch(`/api/admin/servers/${transferServer.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetNodeId: transferTargetNodeId,
          targetAllocationId: transferTargetAllocId || undefined,
          excludePaths,
          preTransferStop: transferPreStop,
          autoStartAfter: transferAutoStart,
          deleteSourceFiles: transferCleanup,
          throttleSpeedMbps: parseInt(transferSpeedMbps) || 0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Poll status
        const poll = setInterval(async () => {
          const statusRes = await fetch(`/api/admin/servers/${transferServer.id}/transfer`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setTransferActive(statusData.activeTransfer);
            if (statusData.activeTransfer?.status === "COMPLETED" || statusData.activeTransfer?.status === "FAILED") {
              clearInterval(poll);
              load();
            }
          }
        }, 1500);
      } else {
        setTransferError(data.error || "Transfer request failed.");
      }
    } catch {
      setTransferError("Network error triggering transfer.");
    }
    setTransferSubmitting(false);
  }

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/admin/servers?${params}`);
    if (res.ok) { const d = await res.json(); setServers(d.servers ?? []); setTotal(d.total ?? 0); }
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const loadJavaVersions = useCallback(async (nodeId?: string) => {
    try {
      const url = nodeId ? `/api/admin/java-versions?nodeId=${nodeId}` : "/api/admin/java-versions";
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setJavaVersions(d.javaVersions || []);
      }
    } catch {}
  }, []);

  function getRecommendedJavaVersion(versionStr?: string): string {
    if (!versionStr) return "21";
    const v = versionStr.toLowerCase();
    if (v.startsWith("26") || v.includes("1.21") || v.includes("1.20.5") || v.includes("1.20.6")) return "21";
    if (v.includes("1.20") || v.includes("1.19") || v.includes("1.18") || v.includes("1.17")) return "17";
    if (v.includes("1.16")) return "11";
    if (v.includes("1.12") || v.includes("1.8") || v.includes("1.7")) return "8";
    return "21";
  }

  function openCreateJavaModal() {
    setEditingJavaVersion(null);
    setJavaForm({
      name: "",
      version: "21",
      dockerImage: "itzg/minecraft-server:java21",
      binaryPath: "java",
      isDefault: false,
      nodeId: "",
      description: "",
    });
    setJavaModalError("");
    setShowJavaModal(true);
  }

  function openEditJavaModal(jv: JavaVersion) {
    setEditingJavaVersion(jv);
    setJavaForm({
      name: jv.name,
      version: jv.version,
      dockerImage: jv.dockerImage || "",
      binaryPath: jv.binaryPath || "java",
      isDefault: jv.isDefault,
      nodeId: jv.nodeId || "",
      description: jv.description || "",
    });
    setJavaModalError("");
    setShowJavaModal(true);
  }

  async function handleSaveJavaVersion() {
    if (!javaForm.name.trim() || !javaForm.version.trim()) {
      setJavaModalError("Name and Version number are required.");
      return;
    }
    setSavingJava(true);
    setJavaModalError("");
    try {
      const url = editingJavaVersion ? `/api/admin/java-versions/${editingJavaVersion.id}` : "/api/admin/java-versions";
      const method = editingJavaVersion ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: javaForm.name.trim(),
          version: javaForm.version.trim(),
          dockerImage: javaForm.dockerImage.trim() || undefined,
          binaryPath: javaForm.binaryPath.trim() || undefined,
          isDefault: javaForm.isDefault,
          nodeId: javaForm.nodeId || null,
          description: javaForm.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowJavaModal(false);
        await loadJavaVersions();
      } else {
        setJavaModalError(data.error || "Failed to save Java version.");
      }
    } catch {
      setJavaModalError("Network error while saving Java version.");
    }
    setSavingJava(false);
  }

  async function handleDeleteJavaVersion(id: string) {
    if (!confirm("Are you sure you want to delete this Java version?")) return;
    setDeletingJavaId(id);
    try {
      const res = await fetch(`/api/admin/java-versions/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadJavaVersions();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete Java version.");
      }
    } catch {}
    setDeletingJavaId(null);
  }

  async function handleSetDefaultJava(id: string) {
    try {
      const res = await fetch(`/api/admin/java-versions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        await loadJavaVersions();
      }
    } catch {}
  }

  const searchParams = useSearchParams();

  async function openCreate(preselectedImageId?: string) {
    setShowCreate(true);
    setStep(0);
    setCreateError("");
    setForm({ ...EMPTY_FORM });
    try {
      const isJson = (r: Response) => r.headers.get("content-type")?.includes("application/json");
      const [nodeRes, userRes, swRes, tplRes, jvRes, imgRes] = await Promise.all([
        fetch("/api/admin/nodes"),
        fetch("/api/admin/users?limit=100"),
        fetch("/api/admin/software"),
        fetch("/api/admin/templates"),
        fetch("/api/admin/java-versions"),
        fetch("/api/admin/images"),
      ]);
      let loadedNodes: Node[] = [];
      let loadedUsers: User[] = [];
      if (nodeRes.ok && isJson(nodeRes)) {
        loadedNodes = (await nodeRes.json()).nodes ?? [];
        setNodes(loadedNodes);
      } else if (!isJson(nodeRes)) { window.location.href = "/login"; return; }
      if (userRes.ok && isJson(userRes)) {
        loadedUsers = (await userRes.json()).users ?? [];
        setUsers(loadedUsers);
      }
      if (swRes.ok && isJson(swRes)) setSoftwareList((await swRes.json()).software ?? []);
      if (tplRes.ok && isJson(tplRes)) setTemplatesList((await tplRes.json()).templates ?? []);
      if (jvRes.ok && isJson(jvRes)) setJavaVersions((await jvRes.json()).javaVersions ?? []);
      
      let loadedImages: ContainerImage[] = [];
      if (imgRes.ok && isJson(imgRes)) {
        loadedImages = (await imgRes.json()).images ?? [];
        setContainerImages(loadedImages);
      }

      if (preselectedImageId) {
        const found = loadedImages.find(img => img.id === preselectedImageId || img.dockerImage === preselectedImageId);
        if (found) {
          const targetNodeId = found.nodeId || (loadedNodes.find(n => n.status === "ONLINE")?.id || loadedNodes[0]?.id || "");
          const targetOwnerId = loadedUsers[0]?.id || "";
          setForm(f => ({
            ...f,
            name: `${found.name} Instance`,
            serverType: "CUSTOM",
            customImageId: found.id,
            nodeId: targetNodeId,
            ownerId: targetOwnerId,
            startupCommand: found.defaultStartup || "",
            ram: "2048",
            cpu: "100",
            disk: "10240",
          }));
        }
      }
    } catch { setCreateError("Failed to load data."); }
  }

  // Auto-open create modal if query param requested
  useEffect(() => {
    const targetImageId = searchParams.get("imageId");
    const isCreateRequested = searchParams.get("create") === "true" || !!targetImageId;
    if (isCreateRequested) {
      openCreate(targetImageId || undefined);
    }
  }, [searchParams]);

  // Fetch free allocations when node changes and auto-assign the node port
  useEffect(() => {
    if (form.nodeId) {
      fetch(`/api/admin/allocations?nodeId=${form.nodeId}&assigned=false`)
        .then(r => r.json())
        .then(d => {
          const freeAllocs = d.allocations ?? [];
          setAllocations(freeAllocs);
          if (freeAllocs.length > 0) {
            setForm(f => ({ ...f, allocationId: freeAllocs[0].id }));
          } else {
            setForm(f => ({ ...f, allocationId: "" }));
          }
        })
        .catch(() => setAllocations([]));
    } else {
      setAllocations([]);
      setForm(f => ({ ...f, allocationId: "" }));
    }
  }, [form.nodeId]);

  // Auto-populate startup command when software or RAM changes
  useEffect(() => {
    if (form.softwareId && form.ram) {
      const ramMb = parseInt(form.ram) || 1024;
      const xms = Math.max(128, Math.round(ramMb * 0.25));
      setForm(f => ({
        ...f,
        startupCommand: `java -Xms${xms}M -Xmx${ramMb}M -jar server.jar --nogui`,
      }));
    }
  }, [form.softwareId, form.ram]);

  async function syncSoftware() {
    setSyncing(true);
    const res = await fetch("/api/admin/software/sync", { method: "POST" });
    if (res.ok) {
      const swRes = await fetch("/api/admin/software");
      if (swRes.ok) setSoftwareList((await swRes.json()).software ?? []);
    }
    setSyncing(false);
  }

  async function createServer() {
    setCreating(true); setCreateError("");
    // Parse specific ports
    const specificPortsList = form.specificPorts
      .split(",")
      .map(p => p.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n) && n > 0);

    const res = await fetch("/api/admin/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        ownerId: form.ownerId,
        nodeId: form.nodeId,
        allocationId: form.allocationId || undefined,
        ram: parseInt(form.ram),
        cpu: parseInt(form.cpu),
        disk: parseInt(form.disk),
        swap: parseInt(form.swap) || 0,
        serverType: form.serverType || "MINECRAFT",
        nodeVersion: form.nodeVersion || "20",
        securityProtection: form.securityProtection !== false,
        softwareId: form.softwareId || undefined,
        softwareVersionId: form.softwareVersionId || undefined,
        templateId: form.templateId || undefined,
        javaVersion: form.javaVersion || "21",
        javaVersionId: form.javaVersionId || undefined,
        customImageId: form.customImageId || undefined,
        startupCommand: form.startupCommand || undefined,
        portCount: parseInt(form.portCount) || 1,
        specificPorts: specificPortsList,
        allowedPaths: JSON.stringify(form.allowedPaths.split(",").map(p => p.trim()).filter(Boolean)),
        protectedPaths: JSON.stringify(form.protectedPaths.split(",").map(p => p.trim()).filter(Boolean)),
        blockedUploadPaths: JSON.stringify(form.blockedUploadPaths.split(",").map(p => p.trim()).filter(Boolean)),
        allowNodeTransfer: form.allowNodeTransfer,
        allowGoogleDriveBackups: form.allowGoogleDriveBackups,
        cryoSleepEnabled: form.cryoSleepEnabled,
        cryoSleepIdleMinutes: parseInt(form.cryoSleepIdleMinutes) || 10,
        cryoSleepCustomMotdAllowed: form.cryoSleepCustomMotdAllowed,
        cryoSleepMotd: form.cryoSleepMotd || null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        gracePeriodDays: parseInt(form.gracePeriodDays) || 0,
        autoSuspendOnExpiry: form.autoSuspendOnExpiry,
        autoDeleteOnGraceExpiry: form.autoDeleteOnGraceExpiry,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } else {
      let errMsg = "Failed to create server";
      try {
        const d = await res.json();
        errMsg = d.error ?? (d.details ? JSON.stringify(d.details) : errMsg);
      } catch {
        const text = await res.text().catch(() => "");
        if (text) errMsg = `Server error (${res.status}): ${text.slice(0, 100)}`;
      }
      setCreateError(errMsg);
    }
    setCreating(false);
  }

  async function powerAction(serverId: string, action: string) {
    await fetch(`/api/admin/servers/${serverId}/power`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTimeout(load, 1500);
  }

  async function suspendToggle(serverId: string, suspend: boolean) {
    await fetch(`/api/admin/servers/${serverId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: suspend }),
    });
    await load();
  }

  async function handleDeleteServer() {
    if (!deleteServerId) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/servers/${deleteServerId}`, { method: "DELETE" });
    if (res.ok) { setDeleteServerId(null); await load(); }
    else alert("Failed to delete server");
    setDeleting(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectedSoftware = softwareList.find(s => s.id === form.softwareId);

  // Filter versions based on stable toggle — OFF by default = show ALL versions
  const filteredVersions = selectedSoftware?.versions.filter(v =>
    form.showStableOnly ? v.isStable : true
  ) ?? [];

  const canNext = () => {
    if (step === 0) return !!(form.name.trim() && form.ownerId && form.nodeId);
    if (step === 1) return !!(form.ram && form.cpu && form.disk);
    return true;
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>Servers</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>{total} total servers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadJavaVersions(); setShowJavaModal(true); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm border font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
          >
            <Coffee className="w-4 h-4 text-amber-400" />
            <span>Manage Java</span>
          </button>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
            <Plus className="w-4 h-4" /> Create Server
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--color-rp-text-muted)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search servers..."
          className="w-full h-10 pl-10 pr-3 rounded-lg border text-sm outline-none"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }} />
      </div>

      {/* ── Create Server Wizard Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <div>
                <h2 className="font-bold text-lg" style={{ color: "var(--color-rp-text)" }}>Create New Server</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>
                  Step {step + 1} of {STEPS.length}: {STEPS[step].label}
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ color: "var(--color-rp-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex border-b" style={{ borderColor: "var(--color-rp-border)" }}>
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const active = i === step;
                return (
                  <button key={i} onClick={() => i < step && setStep(i)}
                    className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all relative"
                    style={active ? { color: "var(--color-rp-accent)" } : done ? { color: "var(--color-rp-text-muted)" } : { color: "var(--color-rp-text-dim)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center border transition-all"
                      style={active
                        ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                        : done
                          ? { backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-accent)", color: "var(--color-rp-accent)" }
                          : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-dim)" }}>
                      {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span>{s.label}</span>
                    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "var(--color-rp-accent)" }} />}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
              {createError && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "var(--color-rp-red)" }}>
                  {createError}
                </div>
              )}

              {/* ── STEP 0: Details ── */}
              {step === 0 && (
                <div className="space-y-4">
                  <Field label="Server Platform Type *">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          serverType: "MINECRAFT",
                          customImageId: "",
                          startupCommand: f.startupCommand && !f.startupCommand.includes("node") && !f.startupCommand.includes("python") && !f.startupCommand.includes("cargo") ? f.startupCommand : "java -Xms256M -Xmx1024M -jar server.jar --nogui",
                          allowedPaths: "/",
                          protectedPaths: "",
                        }))}
                        className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                        style={form.serverType === "MINECRAFT"
                          ? { backgroundColor: "var(--color-rp-accent-glow)", borderColor: "var(--color-rp-accent)" }
                          : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: form.serverType === "MINECRAFT" ? "var(--color-rp-accent)" : "var(--color-rp-surface-2)", color: form.serverType === "MINECRAFT" ? "#000" : "var(--color-rp-text)" }}>
                          <Gamepad2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-xs" style={{ color: form.serverType === "MINECRAFT" ? "var(--color-rp-accent)" : "var(--color-rp-text)" }}>
                            Minecraft Server
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                            Paper, Spigot, Forge, Fabric &amp; JVMs
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          serverType: "NODEJS",
                          customImageId: "",
                          startupCommand: "node server.js",
                          allowedPaths: "/",
                          protectedPaths: "",
                        }))}
                        className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                        style={form.serverType === "NODEJS"
                          ? { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "#22c55e" }
                          : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold font-mono text-sm"
                          style={{ backgroundColor: form.serverType === "NODEJS" ? "#22c55e" : "var(--color-rp-surface-2)", color: form.serverType === "NODEJS" ? "#000" : "#22c55e" }}>
                          JS
                        </div>
                        <div>
                          <p className="font-bold text-xs flex items-center gap-1" style={{ color: form.serverType === "NODEJS" ? "#22c55e" : "var(--color-rp-text)" }}>
                            <span>Node.js Server</span>
                            <Shield className="w-3 h-3" />
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                            Node 18–23 LTS + Threat Shield
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const firstImg = containerImages[0];
                          setForm(f => ({
                            ...f,
                            serverType: "CUSTOM",
                            customImageId: firstImg?.id || "",
                            startupCommand: firstImg?.defaultStartup || "python -u main.py",
                            allowedPaths: "/",
                            protectedPaths: "",
                          }));
                        }}
                        className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                        style={form.serverType === "CUSTOM"
                          ? { backgroundColor: "rgba(168, 85, 247, 0.12)", borderColor: "#a855f7" }
                          : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: form.serverType === "CUSTOM" ? "#a855f7" : "var(--color-rp-surface-2)", color: form.serverType === "CUSTOM" ? "#fff" : "var(--color-rp-text)" }}>
                          <Box className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-xs" style={{ color: form.serverType === "CUSTOM" ? "#c084fc" : "var(--color-rp-text)" }}>
                            Custom Online Images
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                            Python, Rust, MySQL, Redis &amp; OCI
                          </p>
                        </div>
                      </button>
                    </div>
                  </Field>

                  <Field label="Server Name *">
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={form.serverType === "NODEJS" ? "e.g. Discord Bot / API Service" : form.serverType === "CUSTOM" ? "e.g. Python FastAPI Worker / MySQL DB" : "e.g. My Survival Server"}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                  </Field>
                  <Field label="Owner *">
                    <select value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle}>
                      <option value="">Select user...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.email})</option>)}
                    </select>
                  </Field>
                  <Field label="Node *">
                    <select value={form.nodeId} onChange={e => setForm(f => ({ ...f, nodeId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle}>
                      <option value="">Select node...</option>
                      {nodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.fqdn})</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {/* ── STEP 1: Resources ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="RAM (MB) *">
                      <input type="number" value={form.ram} onChange={e => setForm(f => ({ ...f, ram: e.target.value }))} min="128"
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                      <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>1024 MB = 1 GB</p>
                    </Field>
                    <Field label="CPU Limit (%)">
                      <input type="number" value={form.cpu} onChange={e => setForm(f => ({ ...f, cpu: e.target.value }))} min="1" max="400"
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                      <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>100% = 1 core · 400% = 4 cores</p>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Disk Space (MB) *">
                      <input type="number" value={form.disk} onChange={e => setForm(f => ({ ...f, disk: e.target.value }))} min="512"
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                      <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>5120 MB = 5 GB</p>
                    </Field>
                    <Field label="Swap (MB)">
                      <input type="number" value={form.swap} onChange={e => setForm(f => ({ ...f, swap: e.target.value }))} min="0"
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                      <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>0 = disabled</p>
                    </Field>
                  </div>
                  <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                    Summary: <strong style={{ color: "var(--color-rp-text)" }}>{form.ram} MB RAM</strong> ·{" "}
                    <strong style={{ color: "var(--color-rp-text)" }}>{form.cpu}% CPU</strong> ·{" "}
                    <strong style={{ color: "var(--color-rp-text)" }}>{Math.round(parseInt(form.disk || "0") / 1024)} GB Disk</strong>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Software & Runtimes ── */}
              {step === 2 && (
                <div className="space-y-4">
                  {form.serverType === "NODEJS" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium flex-1" style={{ color: "var(--color-rp-text)" }}>
                          Select Node.js Runtime Version
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          v{form.nodeVersion || "20"} Selected
                        </span>
                      </div>

                      <Field label="Node.js Engine Version *">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { ver: "22", name: "Node.js 22 (Current LTS)", image: "node:22-alpine", desc: "Recommended for modern ECMAScript features and high throughput." },
                            { ver: "20", name: "Node.js 20 (Active LTS)", image: "node:20-alpine", desc: "Long Term Support release with maximum ecosystem stability." },
                            { ver: "18", name: "Node.js 18 (Maintenance LTS)", image: "node:18-alpine", desc: "Maintains legacy module and dependency compatibility." },
                            { ver: "23", name: "Node.js 23 (Latest)", image: "node:23-alpine", desc: "Bleeding edge release with latest V8 compiler enhancements." },
                          ].map(nv => {
                            const isSelected = (form.nodeVersion || "20") === nv.ver;
                            return (
                              <button
                                key={nv.ver}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, nodeVersion: nv.ver }))}
                                className="flex flex-col items-start p-3.5 rounded-xl border text-left transition-all"
                                style={isSelected
                                  ? { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "#22c55e" }
                                  : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                              >
                                <div className="flex items-center justify-between w-full mb-1">
                                  <div className="flex items-center gap-2 font-bold text-xs" style={{ color: isSelected ? "#4ade80" : "var(--color-rp-text)" }}>
                                    <div className="w-5 h-5 rounded flex items-center justify-center font-mono text-[10px] font-bold"
                                      style={{ backgroundColor: isSelected ? "#22c55e" : "var(--color-rp-surface-2)", color: isSelected ? "#000" : "#4ade80" }}>
                                      JS
                                    </div>
                                    <span>{nv.name}</span>
                                  </div>
                                  {nv.ver === "20" && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      LTS
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400">{nv.image}</span>
                                <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "var(--color-rp-text-muted)" }}>
                                  {nv.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="Startup Entrypoint Command" hint="Default startup script executed when booting this Node.js instance.">
                        <input
                          value={form.startupCommand || "node server.js"}
                          onChange={e => setForm(f => ({ ...f, startupCommand: e.target.value }))}
                          placeholder="node server.js"
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                          style={fieldStyle}
                        />
                      </Field>
                    </>
                  ) : form.serverType === "CUSTOM" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>
                            Select Online Container Image / Multi-Runtime
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                            Pre-pulled online Docker images ready across connected nodes.
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded font-bold font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {containerImages.length} Images Available
                        </span>
                      </div>

                      {containerImages.length === 0 ? (
                        <div className="p-6 rounded-2xl border text-center space-y-2" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                          <Box className="w-8 h-8 mx-auto text-lime-400 opacity-40" />
                          <p className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>No container images installed yet</p>
                          <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                            You need to &quot;Get&quot; an image from the Docker Hub Library before creating a custom container server.
                          </p>
                          <Link
                            href="/images"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-lime-400/30 bg-lime-400 text-black hover:bg-lime-300 transition-all mt-2"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Browse &amp; Get Images (/images)</span>
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                          {containerImages.map(img => {
                            const isSelected = (form.customImageId === img.id) || (!form.customImageId && containerImages[0]?.id === img.id);
                            return (
                              <button
                                key={img.id}
                                type="button"
                                onClick={() => setForm(f => ({
                                  ...f,
                                  customImageId: img.id,
                                  startupCommand: img.defaultStartup || f.startupCommand,
                                }))}
                                className="flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all"
                                style={isSelected
                                  ? { backgroundColor: "rgba(163, 230, 53, 0.12)", borderColor: "var(--color-rp-accent)", borderWidth: "1.5px" }
                                  : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                              >
                                <div className="flex items-center justify-between w-full mb-1.5">
                                  <div className="flex items-center gap-2 font-bold text-xs" style={{ color: isSelected ? "var(--color-rp-accent)" : "var(--color-rp-text)" }}>
                                    {img.category === "DATABASE" ? <Database className="w-4 h-4 text-blue-400 shrink-0" /> : img.category === "RUNTIME" ? <Code className="w-4 h-4 text-lime-400 shrink-0" /> : img.category === "WEB" ? <Globe className="w-4 h-4 text-yellow-400 shrink-0" /> : <Box className="w-4 h-4 text-purple-400 shrink-0" />}
                                    <span className="truncate">{img.name}</span>
                                  </div>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-black/40 text-lime-300 shrink-0">
                                    {img.category}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-lime-400/90 truncate block w-full">{img.dockerImage}</span>
                                <div className="flex items-center justify-between w-full mt-2 text-[10px]" style={{ color: "var(--color-rp-text-muted)" }}>
                                  <span>Port: <strong className="text-white">:{img.defaultPort}</strong></span>
                                  <span className="truncate">Node: <strong className="text-white">{img.node?.name || "Global"}</strong></span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <Field label="Startup Entrypoint Command" hint="Command executed inside container when starting up (e.g. python -u main.py, cargo run --release, mysqld).">
                        <input
                          value={form.startupCommand || ""}
                          onChange={e => setForm(f => ({ ...f, startupCommand: e.target.value }))}
                          placeholder="e.g. python -u main.py"
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                          style={fieldStyle}
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      {/* Header row: title + stable toggle + sync */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium flex-1" style={{ color: "var(--color-rp-text)" }}>
                          Select software and version
                        </p>
                        {/* Stable-only toggle */}
                        <button
                          onClick={() => setForm(f => ({ ...f, showStableOnly: !f.showStableOnly, softwareVersionId: "" }))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition-all"
                          style={form.showStableOnly
                            ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                            : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                          <Filter className="w-3 h-3" />
                          {form.showStableOnly ? "Stable Only" : "Show All Versions"}
                        </button>
                        <button onClick={syncSoftware} disabled={syncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-50"
                          style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                          {syncing ? "Syncing..." : "Sync"}
                        </button>
                      </div>

                      {/* Software grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {softwareList.map(s => (
                          <button key={s.id} type="button"
                            onClick={() => {
                              const isP = s.name === "Pumpkin" || s.type === "PUMPKIN";
                              setForm(f => ({
                                ...f,
                                softwareId: s.id === f.softwareId ? "" : s.id,
                                softwareVersionId: "",
                                portCount: isP ? String(Math.max(2, parseInt(f.portCount) || 1)) : f.portCount,
                                serverType: isP ? "PUMPKIN" : "MINECRAFT",
                              }));
                            }}
                            className="p-3 rounded-lg border text-left transition-all"
                            style={form.softwareId === s.id
                              ? { backgroundColor: "var(--color-rp-accent-glow)", borderColor: "var(--color-rp-accent)" }
                              : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                            <div className="font-semibold text-xs flex items-center justify-between"
                              style={{ color: form.softwareId === s.id ? "var(--color-rp-accent)" : "var(--color-rp-text)" }}>
                              <span>{s.name}</span>
                              {form.softwareId === s.id && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                              {form.showStableOnly
                                ? `${s.versions.filter(v => v.isStable).length} stable`
                                : `${s.versions.length} versions`}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Version selector */}
                      {selectedSoftware && (
                        <Field label={`${selectedSoftware.name} Version${form.showStableOnly ? " (stable only)" : " (all)"}`}>
                          <select value={form.softwareVersionId}
                            onChange={e => {
                              const val = e.target.value;
                              const selVer = filteredVersions.find(v => v.id === val)?.version;
                              const recJv = getRecommendedJavaVersion(selVer);
                              setForm(f => ({ ...f, softwareVersionId: val, javaVersion: recJv }));
                            }}
                            className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle}>
                            <option value="">
                              {form.showStableOnly ? "(Latest stable)" : "(Latest — may be unstable)"}
                            </option>
                            {filteredVersions.map(v => {
                              const isPumpkinVer = v.version.startsWith("pumpkin-");
                              const displayName = isPumpkinVer
                                ? (v.version.includes("nightly")
                                  ? `Pumpkin Nightly (Commit: ${v.version.replace("pumpkin-nightly-", "")})`
                                  : `Pumpkin ${v.version.replace("pumpkin-", "")}`)
                                : v.version;

                              return (
                                <option key={v.id} value={v.id}>
                                  {displayName}{!v.isStable && !isPumpkinVer ? " (unstable)" : ""}
                                </option>
                              );
                            })}
                          </select>
                          <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                            {filteredVersions.length} version{filteredVersions.length !== 1 ? "s" : ""} shown
                            {form.showStableOnly ? " · toggle off to see unstable/latest" : " · toggle 'Stable Only' to filter"}
                          </p>
                          {(selectedSoftware.name === "Pumpkin" || selectedSoftware.type === "PUMPKIN") && (
                            <div className="mt-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300 flex items-center gap-2">
                              <span>🔥</span>
                              <span><strong>Pumpkin Rust Core:</strong> Automatically allocates 2 network ports for Java Edition &amp; Bedrock Edition cross-play.</span>
                            </div>
                          )}
                        </Field>
                      )}

                      {/* Java Runtime Version Selector — Only for JVM-based Minecraft software */}
                      {selectedSoftware?.name !== "Pumpkin" && selectedSoftware?.type !== "PUMPKIN" && form.serverType !== "PUMPKIN" ? (
                        <Field label="Java Runtime Environment" hint="Auto-recommended based on software version, or choose custom JDK.">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {javaVersions.map(jv => {
                              const isSelected = form.javaVersion === jv.version || form.javaVersionId === jv.id;
                              return (
                                <button
                                  key={jv.id}
                                  type="button"
                                  onClick={() => setForm(f => ({ ...f, javaVersion: jv.version, javaVersionId: jv.id }))}
                                  className="flex flex-col items-start p-3 rounded-xl border text-left transition-all relative overflow-hidden"
                                  style={isSelected
                                    ? { backgroundColor: "var(--color-rp-accent-glow)", borderColor: "var(--color-rp-accent)" }
                                    : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                                >
                                  <div className="flex items-center justify-between w-full mb-1">
                                    <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: isSelected ? "var(--color-rp-accent)" : "var(--color-rp-text)" }}>
                                      <Coffee className="w-3.5 h-3.5" />
                                      <span>{jv.name}</span>
                                    </div>
                                    {jv.isDefault && (
                                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10.5px] line-clamp-1 opacity-70" style={{ color: "var(--color-rp-text-muted)" }}>
                                    {jv.description || `Java ${jv.version} JVM`}
                                  </p>
                                  {jv.node && (
                                    <span className="text-[9px] mt-1 text-sky-400 font-mono">
                                      Node: {jv.node.name}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-orange-500/25 bg-orange-500/10 space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                            <Flame className="w-4 h-4" />
                            <span>Native Rust Core Engine — Zero Java Runtime Needed</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-relaxed">
                            Pumpkin is built in pure Rust and runs directly as a compiled native Linux binary. It does not require any JVM or Java installation.
                          </p>
                        </div>
                      )}

                      {/* Docker template */}
                      <Field label="Docker Template (optional)">
                        <select value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle}>
                          <option value="">(Default — Standard Java Runner)</option>
                          {templatesList.map(t => <option key={t.id} value={t.id}>{t.name} {t.dockerImage ? `(${t.dockerImage})` : ""}</option>)}
                        </select>
                      </Field>

                      {/* Startup command — auto-populated from resources, editable */}
                      <Field label="Startup Command">
                        <input value={form.startupCommand}
                          onChange={e => setForm(f => ({ ...f, startupCommand: e.target.value }))}
                          placeholder={`java -Xms${Math.max(128, Math.round(parseInt(form.ram || "1024") * 0.25))}M -Xmx${form.ram || "1024"}M -jar server.jar --nogui`}
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                        <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                          Auto-filled from your resource settings · Edit freely
                        </p>
                      </Field>
                    </>
                  )}
                </div>
              )}

              {/* ── STEP 3: Networking ── */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Number of ports */}
                  <Field label="Number of Ports to Allocate">
                    <input type="number" value={form.portCount}
                      onChange={e => setForm(f => ({ ...f, portCount: e.target.value }))}
                      min="1" max="20"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                      1 = primary port only · add extras for RCON (25575), Query (25565), Dynmap (8123), etc.
                    </p>
                  </Field>

                  {/* Specific ports */}
                  <Field label="Specific Ports (optional, comma-separated)">
                    <input value={form.specificPorts}
                      onChange={e => setForm(f => ({ ...f, specificPorts: e.target.value }))}
                      placeholder="e.g. 25565, 25575, 8123"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                      Leave blank to auto-assign from the node's port range. Enter specific ports if needed.
                    </p>
                  </Field>

                  {/* Primary allocation override */}
                  <Field label="Pre-assigned Allocation (optional override)">
                    <select value={form.allocationId} onChange={e => setForm(f => ({ ...f, allocationId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} disabled={!form.nodeId}>
                      <option value="">Auto-assign from node port range</option>
                      {allocations.map(a => <option key={a.id} value={a.id}>{a.ip}:{a.port}</option>)}
                    </select>
                    <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                      {allocations.length > 0
                        ? `${allocations.length} free allocation${allocations.length !== 1 ? "s" : ""} available on this node`
                        : "No pre-assigned allocations found — port will be auto-assigned"}
                    </p>
                  </Field>

                  <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                    Total ports to allocate: <strong style={{ color: "var(--color-rp-text)" }}>{form.portCount || 1}</strong>
                    {form.specificPorts && (
                      <span> · Specific: <strong style={{ color: "var(--color-rp-accent)" }}>{form.specificPorts}</strong></span>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 4: Permissions & Security Shield ── */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Security Threat Protection Shield */}
                  <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                    style={{ backgroundColor: "var(--color-rp-surface)", borderColor: form.securityProtection ? "rgba(34,197,94,0.3)" : "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                            Security Shield &amp; Threat Scanner
                          </p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Recommended
                          </span>
                        </div>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-rp-text-muted)" }}>
                          Monitors and blocks malicious child process execution or unauthorized binary download scripts. Temporarily suspends instance for 5 minutes if harmful code is detected.
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={form.securityProtection}
                      onChange={() => setForm(f => ({ ...f, securityProtection: !f.securityProtection }))}
                      activeColor="#22c55e"
                    />
                  </div>

                  {/* File upload toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                    style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "var(--color-rp-accent-glow)" }}>
                        <Upload className="w-4 h-4" style={{ color: "var(--color-rp-accent)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>Allow File Uploads</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                          Users can upload files, assets, and configs via the file manager
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={form.allowFileUploads}
                      onChange={() => setForm(f => ({ ...f, allowFileUploads: !f.allowFileUploads }))}
                    />
                  </div>

                  <Field label="Allowed Paths (comma-separated)">
                    <input value={form.allowedPaths} onChange={e => setForm(f => ({ ...f, allowedPaths: e.target.value }))}
                      placeholder="/ (Leave as / to allow editing all files)"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Directories the user can browse and edit (/ = full access to all files)</p>
                  </Field>

                  <Field label="Protected Paths (comma-separated)">
                    <input value={form.protectedPaths} onChange={e => setForm(f => ({ ...f, protectedPaths: e.target.value }))}
                      placeholder="e.g. /server.jar (Leave blank to allow editing everything)"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Files users cannot delete or overwrite (blank = nothing blocked)</p>
                  </Field>

                  <Field label="Upload Prevention Folders (comma-separated)">
                    <input value={form.blockedUploadPaths} onChange={e => setForm(f => ({ ...f, blockedUploadPaths: e.target.value }))}
                      placeholder="Leave blank to allow uploads everywhere"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Specific folders where uploads are blocked (blank = nothing blocked)</p>
                  </Field>

                  <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                        <ArrowLeftRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Allow Node Transfer (User Panel)</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Permits server owner and subusers to migrate this instance between available nodes
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={form.allowNodeTransfer}
                      onChange={() => setForm(f => ({ ...f, allowNodeTransfer: !f.allowNodeTransfer }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Allow Google Drive Cloud Backups</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Permits user to link personal Google Drive for automated snapshots &amp; retention rotation
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={form.allowGoogleDriveBackups}
                      onChange={() => setForm(f => ({ ...f, allowGoogleDriveBackups: !f.allowGoogleDriveBackups }))}
                    />
                  </div>

                  {/* Cryo-Sleep Configuration */}
                  <div className="p-4 rounded-xl border space-y-3"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: form.cryoSleepEnabled ? "rgba(56,189,248,0.4)" : "var(--color-rp-border)" }}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                              Cryo-Sleep (0-RAM Hibernation &amp; Auto Wake-on-Ping)
                            </p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              0-RAM Mode
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>
                            Suspends empty instances to disk after idle timeout and listens with a native TCP wake proxy to auto-boot when players join.
                          </p>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={form.cryoSleepEnabled}
                        onChange={() => setForm(f => ({ ...f, cryoSleepEnabled: !f.cryoSleepEnabled }))}
                        activeColor="#38bdf8"
                      />
                    </div>

                    {form.cryoSleepEnabled && (
                      <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--color-rp-border)" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Idle Timeout (Minutes)">
                            <input
                              type="number"
                              min="1"
                              max="1440"
                              value={form.cryoSleepIdleMinutes}
                              onChange={e => setForm(f => ({ ...f, cryoSleepIdleMinutes: e.target.value }))}
                              className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                              style={fieldStyle}
                            />
                            <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Minutes with 0 players before sleeping</p>
                          </Field>

                          <div className="flex items-center justify-between p-3 rounded-lg border"
                            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>Allow User Custom MOTD</p>
                              <p className="text-[10.5px]" style={{ color: "var(--color-rp-text-dim)" }}>Owner can customize wake MOTD</p>
                            </div>
                            <ToggleSwitch
                              checked={form.cryoSleepCustomMotdAllowed}
                              onChange={() => setForm(f => ({ ...f, cryoSleepCustomMotdAllowed: !f.cryoSleepCustomMotdAllowed }))}
                              size="sm"
                            />
                          </div>
                        </div>

                        <Field label="Custom Cryo-Sleep MOTD (Optional override)">
                          <input
                            type="text"
                            value={form.cryoSleepMotd}
                            onChange={e => setForm(f => ({ ...f, cryoSleepMotd: e.target.value }))}
                            placeholder="Leave blank to use global default Rubber Panel MOTD"
                            className="w-full h-10 px-3 rounded-lg border text-xs outline-none font-mono"
                            style={fieldStyle}
                          />
                          <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Supports Minecraft color codes e.g. §bRubber Panel §8| §3Server is in Cryo-Sleep</p>
                        </Field>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 5: Billing & Lifecycle ── */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border space-y-3"
                    style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Expiration &amp; Renewal Date</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Expiration Date (Optional)">
                        <input type="date" value={form.expiresAt}
                          onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                      </Field>

                      <Field label="Grace Period (Days)">
                        <input type="number" min="0" value={form.gracePeriodDays}
                          onChange={e => setForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Auto-Suspend on Expiration</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Automatically shutdown and suspend server when expiration date is reached (sets reason to PAYMENT_DUE)
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={form.autoSuspendOnExpiry}
                        onChange={() => setForm(f => ({ ...f, autoSuspendOnExpiry: !f.autoSuspendOnExpiry }))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Auto-Delete after Grace Period</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Permanently purge server and files if payment/renewal is not completed during grace period
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={form.autoDeleteOnGraceExpiry}
                        onChange={() => setForm(f => ({ ...f, autoDeleteOnGraceExpiry: !f.autoDeleteOnGraceExpiry }))}
                        activeColor="var(--color-rp-red)"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            <div className="px-6 py-4 border-t flex items-center gap-3"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <button onClick={() => setShowCreate(false)}
                className="px-4 h-10 rounded-lg text-sm border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                Cancel
              </button>
              <div className="flex-1" />
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 px-4 h-10 rounded-lg text-sm border"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                  className="flex items-center gap-1.5 px-5 h-10 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={createServer} disabled={creating || !form.name || !form.ownerId || !form.nodeId}
                  className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Check className="w-4 h-4" /> Create Server</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Server Table ── */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2" style={{ color: "var(--color-rp-text-muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : servers.length === 0 ? (
          <div className="p-16 text-center">
            <Server className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-rp-text-dim)" }} />
            <p className="font-semibold" style={{ color: "var(--color-rp-text)" }}>No servers found</p>
            <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>Create a server to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
                    <th className="px-4 py-3 text-left text-xs font-medium min-w-[220px]" style={{ color: "var(--color-rp-text-muted)" }}>Server</th>
                    <th className="px-4 py-3 text-left text-xs font-medium min-w-[140px]" style={{ color: "var(--color-rp-text-muted)" }}>Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap" style={{ color: "var(--color-rp-text-muted)" }}>Node</th>
                    <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap" style={{ color: "var(--color-rp-text-muted)" }}>Resources</th>
                    <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap" style={{ color: "var(--color-rp-text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium min-w-[260px]" style={{ color: "var(--color-rp-text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                  {servers.map(s => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold truncate text-sm" title={s.name} style={{ color: "var(--color-rp-text)" }}>
                            {s.name}
                          </p>
                          {s.serverType === "NODEJS" ? (
                            <span className="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" />
                              <span>Node {s.nodeVersion || "20"}</span>
                            </span>
                          ) : s.serverType === "PYTHON" ? (
                            <span className="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-lime-500/15 text-lime-400 border border-lime-500/25 flex items-center gap-1">
                              <Code className="w-2.5 h-2.5" />
                              <span>Python</span>
                            </span>
                          ) : s.serverType === "RUST" ? (
                            <span className="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center gap-1">
                              <Cpu className="w-2.5 h-2.5" />
                              <span>Rust</span>
                            </span>
                          ) : s.serverType === "DATABASE" ? (
                            <span className="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center gap-1">
                              <Database className="w-2.5 h-2.5" />
                              <span>Database</span>
                            </span>
                          ) : s.serverType === "CUSTOM" ? (
                            <span className="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center gap-1">
                              <Box className="w-2.5 h-2.5" />
                              <span>Container</span>
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              Java {s.javaVersion || "21"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--color-rp-text-dim)" }}>
                          {s.uuid.slice(0, 8)}…
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-sm truncate" title={s.owner?.username ?? "—"} style={{ color: "var(--color-rp-text-muted)" }}>
                          {s.owner?.username ?? "—"}
                        </p>
                        <p className="text-xs truncate" title={s.owner?.email} style={{ color: "var(--color-rp-text-dim)" }}>
                          {s.owner?.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: "var(--color-rp-text-muted)" }}>
                        {s.node?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: "var(--color-rp-text-muted)" }}>
                        <div>{s.ram}MB / {s.cpu}% / {Math.round(s.disk / 1024)}GB</div>
                        <div className="text-[11px] font-sans mt-0.5 font-semibold" style={{ color: "#38bdf8" }}>
                          {s.allocations?.length || 1} Port{(s.allocations?.length || 1) > 1 ? "s" : ""} ({s.allocations?.map(a => `:${a.port}`).join(", ") || ":25565"})
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={s.status} />
                          {s.suspended && <Badge variant="danger" size="sm">Suspended</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status === "RUNNING" ? (
                            <>
                              <button onClick={() => powerAction(s.id, "stop")} title="Stop" className="p-1.5 rounded" style={{ color: "var(--color-rp-red)" }}>
                                <Square className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => powerAction(s.id, "restart")} title="Restart" className="p-1.5 rounded" style={{ color: "var(--color-rp-yellow)" }}>
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => powerAction(s.id, "start")} title="Start" className="p-1.5 rounded" style={{ color: "var(--color-rp-green)" }}>
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => suspendToggle(s.id, !s.suspended)}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ backgroundColor: s.suspended ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: s.suspended ? "var(--color-rp-green)" : "var(--color-rp-red)" }}>
                            {s.suspended ? "Unsuspend" : "Suspend"}
                          </button>
                          <button onClick={() => openPortModal(s)}
                            title="Manage & Allot Extra Ports"
                            className="p-1.5 rounded ml-0.5 flex items-center gap-1 text-xs font-bold transition-colors hover:bg-cyan-500/10"
                            style={{ color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", backgroundColor: "rgba(56,189,248,0.05)" }}>
                            <Network className="w-3 h-3" /> + Port
                          </button>
                          <Link 
                            href={`/servers/${s.id}`} 
                            title="Open Admin Management Dashboard"
                            className="p-1.5 rounded ml-0.5 flex items-center gap-1 text-xs font-bold transition-colors hover:bg-emerald-500/10"
                            style={{ color: "#34d399", border: "1px solid rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.05)" }}
                          >
                            <Terminal className="w-3 h-3" /> Manage
                          </Link>
                          <button onClick={() => openTransferModal(s)}
                            title="Transfer to Another Node" className="p-1.5 rounded ml-0.5 flex items-center gap-1 text-xs font-medium transition-colors hover:bg-purple-500/10"
                            style={{ color: "#c084fc", border: "1px solid rgba(192,132,252,0.25)", backgroundColor: "rgba(192,132,252,0.05)" }}>
                            <ArrowLeftRight className="w-3 h-3" /> Transfer
                          </button>
                          <button onClick={() => openEdit(s)}
                            title="Edit" className="p-1.5 rounded ml-0.5 flex items-center gap-1 text-xs font-medium transition-colors hover:bg-blue-500/10"
                            style={{ color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => setDeleteServerId(s.id)} title="Delete" className="p-1.5 rounded ml-1"
                            style={{ color: "var(--color-rp-text-muted)", backgroundColor: "rgba(239,68,68,0.05)" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Page {page} of {totalPages}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: "var(--color-rp-text-muted)" }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: "var(--color-rp-text-muted)" }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Edit Server Modal ── */}
      {editServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <div>
                <h2 className="font-bold text-lg" style={{ color: "var(--color-rp-text)" }}>Edit Server</h2>
                <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--color-rp-text-dim)" }}>{editServer.name}</p>
              </div>
              <button onClick={() => setEditServer(null)} style={{ color: "var(--color-rp-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b" style={{ borderColor: "var(--color-rp-border)" }}>
              {EDIT_STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === editStep;
                return (
                  <button key={i} onClick={() => setEditStep(i)}
                    className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all relative"
                    style={active ? { color: "var(--color-rp-accent)" } : { color: "var(--color-rp-text-dim)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center border transition-all"
                      style={active
                        ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                        : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-dim)" }}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span>{s.label}</span>
                    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "var(--color-rp-accent)" }} />}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
              {editError && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "var(--color-rp-red)" }}>
                  {editError}
                </div>
              )}

              {/* Tab 0: Details */}
              {editStep === 0 && (
                <div className="space-y-4">
                  <Field label="Server Name">
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                  </Field>
                  <Field label="Owner">
                    <select value={editForm.ownerId} onChange={e => setEditForm(f => ({ ...f, ownerId: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle}>
                      <option value="">Keep current owner</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.email})</option>)}
                    </select>
                  </Field>
                  <Field label="Startup Command">
                    <input value={editForm.startupCommand} onChange={e => setEditForm(f => ({ ...f, startupCommand: e.target.value }))}
                      placeholder="java -Xms256M -Xmx1024M -jar server.jar --nogui"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                  </Field>
                </div>
              )}

              {/* Tab 1: Resources */}
              {editStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="RAM (MB)">
                      <input type="number" value={editForm.ram} min="128"
                        onChange={e => setEditForm(f => ({ ...f, ram: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                    </Field>
                    <Field label="CPU Limit (%)">
                      <input type="number" value={editForm.cpu} min="1" max="400"
                        onChange={e => setEditForm(f => ({ ...f, cpu: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Disk Space (MB)">
                      <input type="number" value={editForm.disk} min="512"
                        onChange={e => setEditForm(f => ({ ...f, disk: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                    </Field>
                    <Field label="Swap (MB)">
                      <input type="number" value={editForm.swap} min="0"
                        onChange={e => setEditForm(f => ({ ...f, swap: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle} />
                    </Field>
                  </div>
                  <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                    <strong style={{ color: "var(--color-rp-text)" }}>{editForm.ram} MB RAM</strong>{" · "}
                    <strong style={{ color: "var(--color-rp-text)" }}>{editForm.cpu}% CPU</strong>{" · "}
                    <strong style={{ color: "var(--color-rp-text)" }}>{Math.round(parseInt(editForm.disk || "0") / 1024)} GB Disk</strong>
                  </div>
                </div>
              )}

              {/* Tab 2: Network / Port Allocations */}
              {editStep === 2 && (
                <div className="space-y-4">
                  {/* Current Assigned Ports */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                        Current Port Allocations ({editAllocations.length})
                      </p>
                      <span className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                        Node: {editServer?.node?.name || "Node"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {editAllocations.length === 0 ? (
                        <div className="p-4 rounded-xl border text-center text-xs" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                          No ports currently assigned to this instance.
                        </div>
                      ) : (
                        editAllocations.map((alloc, i) => (
                          <div key={alloc.id || i}
                            className="flex items-center justify-between p-3 rounded-xl border"
                            style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold"
                                style={{ backgroundColor: i === 0 ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.15)", color: i === 0 ? "#34d399" : "#38bdf8" }}>
                                :{alloc.port}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                                    {alloc.ip}:{alloc.port}
                                  </span>
                                  {i === 0 ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                                      Primary Game Port
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{ backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>
                                      Secondary Port
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                                  {alloc.alias ? `Alias: ${alloc.alias}` : "Direct network binding"}
                                </span>
                              </div>
                            </div>

                            {editAllocations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => unassignPortFromEditServer(alloc.id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                                style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--color-rp-red)", backgroundColor: "rgba(239,68,68,0.06)" }}>
                                Unassign Port
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Available Unassigned Ports on Node */}
                  <div className="pt-2 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-rp-text)" }}>
                      Available Free Ports on Node ({nodeFreeAllocations.filter(a => !editAllocations.some(ea => ea.id === a.id)).length})
                    </p>
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                      {nodeFreeAllocations
                        .filter(a => !editAllocations.some(ea => ea.id === a.id))
                        .slice(0, 18)
                        .map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => assignPortToEditServer(a.id)}
                            className="flex items-center justify-between p-2 rounded-lg border text-xs font-mono transition-all hover:border-[var(--color-rp-accent)]"
                            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                            <span>:{a.port}</span>
                            <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)" }}>
                              + Allot
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Custom Port Creation & Direct Bind */}
                  <div className="pt-2 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-rp-text)" }}>
                      Create &amp; Allot Custom Port
                    </p>
                    <p className="text-xs mb-3" style={{ color: "var(--color-rp-text-dim)" }}>
                      Manually bind any specific port (e.g. 25569, 19132 for Bedrock, 8080 for Web / Dynmap) directly to this instance.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="e.g. 25569"
                        min="1024"
                        max="65535"
                        value={customPortInput}
                        onChange={e => setCustomPortInput(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                        style={fieldStyle}
                      />
                      <button
                        type="button"
                        onClick={createAndAssignCustomPort}
                        disabled={!customPortInput}
                        className="px-4 h-10 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                        style={customPortInput
                          ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
                          : { backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-dim)", opacity: 0.5 }}>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Allot Port</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Software & Runtime */}
              {editStep === 3 && (() => {
                const isNodeJs = editForm.serverType === "NODEJS";
                const selectedSw = softwareList.find(s => s.id === editForm.softwareId);
                const filteredVers = selectedSw?.versions.filter(v => editForm.showStableOnly ? v.isStable : true) ?? [];

                return (
                  <div className="space-y-4">
                    {/* Server Platform Selector */}
                    <Field label="Platform Runtime Architecture">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setEditForm(f => ({ ...f, serverType: "MINECRAFT" }))}
                          className="flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all"
                          style={!isNodeJs
                            ? { backgroundColor: "var(--color-rp-accent-glow)", borderColor: "var(--color-rp-accent)" }
                            : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                            style={{ backgroundColor: !isNodeJs ? "var(--color-rp-accent)" : "var(--color-rp-surface-2)", color: !isNodeJs ? "#000" : "var(--color-rp-text)" }}>
                            <Gamepad2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-xs" style={{ color: !isNodeJs ? "var(--color-rp-accent)" : "var(--color-rp-text)" }}>Minecraft</p>
                            <p className="text-[10px]" style={{ color: "var(--color-rp-text-muted)" }}>Paper, Spigot, Forge &amp; Java</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditForm(f => ({ ...f, serverType: "NODEJS" }))}
                          className="flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all"
                          style={isNodeJs
                            ? { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "#22c55e" }
                            : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs"
                            style={{ backgroundColor: isNodeJs ? "#22c55e" : "var(--color-rp-surface-2)", color: isNodeJs ? "#000" : "#22c55e" }}>
                            JS
                          </div>
                          <div>
                            <p className="font-bold text-xs flex items-center gap-1" style={{ color: isNodeJs ? "#22c55e" : "var(--color-rp-text)" }}>
                              <span>Node.js Server</span>
                              <Shield className="w-3 h-3" />
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--color-rp-text-muted)" }}>Node.js 18–23 LTS Engine</p>
                          </div>
                        </button>
                      </div>
                    </Field>

                    {isNodeJs ? (
                      <>
                        <Field label="Node.js Engine Version">
                          <div className="grid grid-cols-2 gap-2.5">
                            {[
                              { ver: "20", label: "Node.js 20 LTS", badge: "Recommended", desc: "Iron (Active LTS, Maximum Stability)" },
                              { ver: "22", label: "Node.js 22 LTS", badge: "Modern LTS", desc: "Jod (High Performance, ES Modules)" },
                              { ver: "18", label: "Node.js 18 LTS", badge: "Legacy LTS", desc: "Hydrogen (Older Dependency Support)" },
                              { ver: "23", label: "Node.js 23 Current", badge: "Bleeding Edge", desc: "Latest Experimental Features" },
                            ].map(({ ver, label, badge, desc }) => (
                              <button
                                key={ver}
                                type="button"
                                onClick={() => setEditForm(f => ({ ...f, nodeVersion: ver }))}
                                className="p-3 rounded-xl border text-left transition-all"
                                style={editForm.nodeVersion === ver
                                  ? { backgroundColor: "rgba(34, 197, 94, 0.12)", borderColor: "#22c55e" }
                                  : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-xs" style={{ color: editForm.nodeVersion === ver ? "#22c55e" : "var(--color-rp-text)" }}>
                                    {label}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                                    style={{ backgroundColor: editForm.nodeVersion === ver ? "rgba(34, 197, 94, 0.2)" : "var(--color-rp-surface-2)", color: editForm.nodeVersion === ver ? "#22c55e" : "var(--color-rp-text-dim)" }}>
                                    {badge}
                                  </span>
                                </div>
                                <p className="text-[10.5px]" style={{ color: "var(--color-rp-text-muted)" }}>{desc}</p>
                              </button>
                            ))}
                          </div>
                        </Field>

                        <Field label="Startup Script / Entry File" hint="Main JS file executed with node. Defaults to server.js or index.js.">
                          <input
                            type="text"
                            value={editForm.startupCommand}
                            onChange={e => setEditForm(f => ({ ...f, startupCommand: e.target.value }))}
                            placeholder="node server.js"
                            className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                            style={fieldStyle}
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <Field label="Minecraft Server Software">
                            <span className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                              {softwareList.length} software types available
                            </span>
                          </Field>
                          <button
                            type="button"
                            onClick={() => setEditForm(f => ({ ...f, showStableOnly: !f.showStableOnly, softwareVersionId: "" }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-medium transition-all"
                            style={editForm.showStableOnly
                              ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                              : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                            <Filter className="w-3 h-3" />
                            {editForm.showStableOnly ? "Stable Only" : "Show All Versions"}
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {softwareList.map(s => (
                            <button key={s.id}
                              type="button"
                              onClick={() => setEditForm(f => ({ ...f, softwareId: s.id === f.softwareId ? "" : s.id, softwareVersionId: "" }))}
                              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all"
                              style={editForm.softwareId === s.id
                                ? { backgroundColor: "var(--color-rp-accent-glow)", borderColor: "var(--color-rp-accent)", color: "var(--color-rp-accent)" }
                                : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                              <span>{s.name}</span>
                              <span className="text-[10px] opacity-60">{editForm.showStableOnly ? s.versions.filter(v => v.isStable).length : s.versions.length} versions</span>
                            </button>
                          ))}
                        </div>
                        {selectedSw && (
                          <Field label={`${selectedSw.name} Version`}>
                            <select value={editForm.softwareVersionId}
                              onChange={e => {
                                const val = e.target.value;
                                const selVer = filteredVers.find(v => v.id === val)?.version;
                                const recJv = getRecommendedJavaVersion(selVer);
                                setEditForm(f => ({ ...f, softwareVersionId: val, javaVersion: recJv }));
                              }}
                              className="w-full h-10 px-3 rounded-lg border text-sm outline-none" style={fieldStyle}>
                              <option value="">(Latest)</option>
                              {filteredVers.map(v => (
                                <option key={v.id} value={v.id}>{v.version}{!v.isStable ? " (unstable)" : ""}</option>
                              ))}
                            </select>
                          </Field>
                        )}

                        {/* Java Runtime Environment — Only for JVM software */}
                        {selectedSw?.name !== "Pumpkin" && selectedSw?.type !== "PUMPKIN" && editForm.serverType !== "PUMPKIN" ? (
                          <Field label="Java Runtime Environment" hint="JDK execution version used to run this server.">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {javaVersions.map(jv => {
                                const isSelected = editForm.javaVersion === jv.version || editForm.javaVersionId === jv.id;
                                return (
                                  <button
                                    key={jv.id}
                                    type="button"
                                    onClick={() => setEditForm(f => ({ ...f, javaVersion: jv.version, javaVersionId: jv.id }))}
                                    className="flex flex-col items-start p-3 rounded-xl border text-left transition-all relative overflow-hidden"
                                    style={isSelected
                                      ? { backgroundColor: "var(--color-rp-accent-glow)", borderColor: "var(--color-rp-accent)" }
                                      : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                                  >
                                    <div className="flex items-center justify-between w-full mb-1">
                                      <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: isSelected ? "var(--color-rp-accent)" : "var(--color-rp-text)" }}>
                                        <Coffee className="w-3.5 h-3.5" />
                                        <span>{jv.name}</span>
                                      </div>
                                      {jv.isDefault && (
                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10.5px] line-clamp-1 opacity-70" style={{ color: "var(--color-rp-text-muted)" }}>
                                      {jv.description || `Java ${jv.version} JVM`}
                                    </p>
                                    {jv.node && (
                                      <span className="text-[9px] mt-1 text-sky-400 font-mono">
                                        Node: {jv.node.name}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </Field>
                        ) : (
                          <div className="p-3.5 rounded-xl border border-orange-500/25 bg-orange-500/10 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                              <Flame className="w-4 h-4" />
                              <span>Native Rust Core Engine</span>
                            </div>
                            <p className="text-[11px] text-zinc-300">
                              Pumpkin runs as a compiled Linux binary with native Java Edition and Bedrock Edition NetherNet networking.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Tab 4: Permissions */}
              {editStep === 4 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <FolderOpen className="w-4 h-4" style={{ color: "var(--color-rp-accent)" }} />
                      <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Allowed Paths</p>
                    </div>
                    <input value={editForm.allowedPaths}
                      onChange={e => setEditForm(f => ({ ...f, allowedPaths: e.target.value }))}
                      placeholder="/ (Leave as / to allow editing everything)"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-2" style={{ color: "var(--color-rp-text-dim)" }}>Comma-separated paths the user can browse, create files in, and upload to (/ = full access)</p>
                  </div>

                  <div className="p-4 rounded-xl border" style={{ borderColor: "rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.04)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="w-4 h-4 text-red-400" />
                      <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Protected Paths</p>
                    </div>
                    <input value={editForm.protectedPaths}
                      onChange={e => setEditForm(f => ({ ...f, protectedPaths: e.target.value }))}
                      placeholder="Leave blank to allow editing all files"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-2" style={{ color: "var(--color-rp-text-dim)" }}>Files and folders the user cannot delete, rename, or overwrite (blank = nothing blocked)</p>
                  </div>

                  <div className="p-4 rounded-xl border" style={{ borderColor: "rgba(234,179,8,0.2)", backgroundColor: "rgba(234,179,8,0.04)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Upload className="w-4 h-4 text-yellow-400" />
                      <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Upload Prevention Folders</p>
                    </div>
                    <input value={editForm.blockedUploadPaths}
                      onChange={e => setEditForm(f => ({ ...f, blockedUploadPaths: e.target.value }))}
                      placeholder="Leave blank to allow uploads everywhere"
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono" style={fieldStyle} />
                    <p className="text-xs mt-2" style={{ color: "var(--color-rp-text-dim)" }}>Specific folders where users are strictly blocked from uploading files</p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                        <ArrowLeftRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Allow Node Transfer (User Panel)</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Permits server owner and subusers to migrate this instance between available nodes
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={editForm.allowNodeTransfer}
                      onChange={() => setEditForm(f => ({ ...f, allowNodeTransfer: !f.allowNodeTransfer }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border gap-4"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Allow Google Drive Cloud Backups</p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Permits user to link personal Google Drive for automated snapshot creation &amp; retention rotation
                        </p>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={editForm.allowGoogleDriveBackups}
                      onChange={() => setEditForm(f => ({ ...f, allowGoogleDriveBackups: !f.allowGoogleDriveBackups }))}
                    />
                  </div>

                  {/* Cryo-Sleep Configuration */}
                  <div className="p-4 rounded-xl border space-y-3"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: editForm.cryoSleepEnabled ? "rgba(56,189,248,0.4)" : "var(--color-rp-border)" }}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                              Cryo-Sleep (0-RAM Hibernation &amp; Auto Wake-on-Ping)
                            </p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              0-RAM Mode
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-dim)" }}>
                            Suspends empty instances to disk after idle timeout and listens with a native TCP wake proxy to auto-boot when players join.
                          </p>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={editForm.cryoSleepEnabled}
                        onChange={() => setEditForm(f => ({ ...f, cryoSleepEnabled: !f.cryoSleepEnabled }))}
                        activeColor="#38bdf8"
                      />
                    </div>

                    {editForm.cryoSleepEnabled && (
                      <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--color-rp-border)" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Idle Timeout (Minutes)">
                            <input
                              type="number"
                              min="1"
                              max="1440"
                              value={editForm.cryoSleepIdleMinutes}
                              onChange={e => setEditForm(f => ({ ...f, cryoSleepIdleMinutes: e.target.value }))}
                              className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                              style={fieldStyle}
                            />
                            <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Minutes with 0 players before sleeping</p>
                          </Field>

                          <div className="flex items-center justify-between p-3 rounded-lg border"
                            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>Allow User Custom MOTD</p>
                              <p className="text-[10.5px]" style={{ color: "var(--color-rp-text-dim)" }}>Owner can customize wake MOTD</p>
                            </div>
                            <ToggleSwitch
                              checked={editForm.cryoSleepCustomMotdAllowed}
                              onChange={() => setEditForm(f => ({ ...f, cryoSleepCustomMotdAllowed: !f.cryoSleepCustomMotdAllowed }))}
                              size="sm"
                            />
                          </div>
                        </div>

                        <Field label="Custom Cryo-Sleep MOTD (Optional override)">
                          <input
                            type="text"
                            value={editForm.cryoSleepMotd}
                            onChange={e => setEditForm(f => ({ ...f, cryoSleepMotd: e.target.value }))}
                            placeholder="Leave blank to use global default Rubber Panel MOTD"
                            className="w-full h-10 px-3 rounded-lg border text-xs outline-none font-mono"
                            style={fieldStyle}
                          />
                          <p className="text-[11px] mt-1" style={{ color: "var(--color-rp-text-dim)" }}>Supports Minecraft color codes e.g. §bRubber Panel §8| §3Server is in Cryo-Sleep</p>
                        </Field>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border text-sm" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                    <p className="font-medium mb-1" style={{ color: "var(--color-rp-text)" }}>How it works</p>
                    <ul className="space-y-1 text-xs list-disc pl-4">
                      <li>Users can only browse and upload into <strong>Allowed Paths</strong> (/ = everything)</li>
                      <li>Users cannot delete or modify any file in <strong>Protected Paths</strong> (blank = nothing blocked)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Tab 5: Billing & Lifecycle */}
              {editStep === 5 && (
                <div className="space-y-4">
                  <Field label="Expiration Date">
                    <input
                      type="date"
                      value={editForm.expiresAt}
                      onChange={e => setEditForm(f => ({ ...f, expiresAt: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none"
                      style={fieldStyle}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Grace Period (Days)">
                      <input
                        type="number"
                        min="0"
                        value={editForm.gracePeriodDays}
                        onChange={e => setEditForm(f => ({ ...f, gracePeriodDays: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none"
                        style={fieldStyle}
                      />
                    </Field>
                    <Field label="Suspension Reason">
                      <input
                        type="text"
                        placeholder="e.g. BILLING_OVERDUE"
                        value={editForm.suspensionReason}
                        onChange={e => setEditForm(f => ({ ...f, suspensionReason: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border text-sm outline-none"
                        style={fieldStyle}
                      />
                    </Field>
                  </div>

                  <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                          Auto-Suspend Container on Expiry
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Immediately stops container when expiration timestamp passes
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={editForm.autoSuspendOnExpiry}
                        onChange={() => setEditForm(f => ({ ...f, autoSuspendOnExpiry: !f.autoSuspendOnExpiry }))}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                          Auto-Purge / Delete Server on Grace Expiry
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          Permanently delete server and files when grace period ends without renewal
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={editForm.autoDeleteOnGraceExpiry}
                        onChange={() => setEditForm(f => ({ ...f, autoDeleteOnGraceExpiry: !f.autoDeleteOnGraceExpiry }))}
                        activeColor="var(--color-rp-red)"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex items-center gap-3"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <button onClick={() => setEditServer(null)}
                className="px-4 h-10 rounded-lg text-sm border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                Cancel
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {EDIT_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setEditStep(i)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{ backgroundColor: i === editStep ? "var(--color-rp-accent)" : "var(--color-rp-border-2)" }} />
                ))}
              </div>
              <div className="flex-1" />
              <button onClick={saveEdit} disabled={saving || !editForm.name}
                className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Check className="w-4 h-4" />Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Node Transfer Modal ── */}
      {transferServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(192,132,252,0.15)", color: "#c084fc" }}>
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: "var(--color-rp-text)" }}>Node Transfer Orchestrator</h2>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                    Migrate server instance <strong>{transferServer.name}</strong> across daemon cluster
                  </p>
                </div>
              </div>
              <button onClick={() => setTransferServer(null)} style={{ color: "var(--color-rp-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {transferError && (
                <div className="p-3 rounded-lg text-sm flex items-center gap-2"
                  style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "var(--color-rp-red)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {transferLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "var(--color-rp-accent)" }} />
                  <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>Scanning available cluster nodes...</p>
                </div>
              ) : transferActive && (transferActive.status === "PREPARING" || transferActive.status === "TRANSFERRING" || transferActive.status === "CONFIGURING") ? (
                /* Active Transfer Live Progress */
                <div className="p-6 rounded-xl border space-y-4"
                  style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>
                          Transferring Instance ({transferActive.progress}%)
                        </h4>
                        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                          {transferActive.sourceNode?.name || "Source"} &rarr; {transferActive.targetNode?.name || "Destination"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full font-bold uppercase"
                      style={{ backgroundColor: "rgba(192,132,252,0.15)", color: "#c084fc" }}>
                      {transferActive.status}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full overflow-hidden bg-black/40">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${transferActive.progress}%` }} />
                  </div>

                  <div className="p-3 rounded-lg text-xs font-mono border flex items-center gap-2"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                    <Zap className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span>{transferActive.currentStep || "Running migration pipeline..."}</span>
                  </div>
                </div>
              ) : (
                /* Configuration Form */
                <>
                  {/* Target Node Selection */}
                  <Field label="1. Destination Node">
                    {transferNodes.length === 0 ? (
                      <div className="p-4 rounded-xl text-center text-sm border"
                        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                        No other online nodes found in the cluster.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {transferNodes.map((n: any) => {
                          const isSelected = transferTargetNodeId === n.id;
                          return (
                            <div key={n.id}
                              onClick={() => {
                                setTransferTargetNodeId(n.id);
                                if (n.allocations?.length > 0) setTransferTargetAllocId(n.allocations[0].id);
                                else setTransferTargetAllocId("");
                              }}
                              className="p-3 rounded-xl border cursor-pointer transition-all"
                              style={{
                                backgroundColor: isSelected ? "var(--color-rp-surface-2)" : "var(--color-rp-surface)",
                                borderColor: isSelected ? "var(--color-rp-accent)" : "var(--color-rp-border)",
                              }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>
                                  {n.name}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                  ONLINE
                                </span>
                              </div>
                              <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                                {n.fqdn}:{n.port} &bull; {n.location || "Default Location"}
                              </p>
                              <div className="mt-2 text-[11px] font-mono" style={{ color: "var(--color-rp-text-muted)" }}>
                                {n.allocations?.length || 0} free port allocations
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Field>

                  {/* Target Allocation / Port */}
                  <Field label="2. Target Port / Allocation">
                    {(() => {
                      const selectedNode = transferNodes.find((n: any) => n.id === transferTargetNodeId);
                      const nodeAllocs = selectedNode?.allocations || [];
                      return (
                        <select
                          value={transferTargetAllocId}
                          onChange={(e) => setTransferTargetAllocId(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                          style={fieldStyle}
                        >
                          <option value="">Auto-assign next available port</option>
                          {nodeAllocs.map((a: any) => (
                            <option key={a.id} value={a.id}>
                              {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ""}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </Field>

                  {/* Customization Options */}
                  <Field label="3. Transfer Customizations">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                        <input type="checkbox" checked={transferPreStop} onChange={e => setTransferPreStop(e.target.checked)}
                          className="rounded accent-purple-500" />
                        <div>
                          <span className="font-semibold block">Graceful Pre-Stop</span>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>Stops container safely before archiving</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                        <input type="checkbox" checked={transferAutoStart} onChange={e => setTransferAutoStart(e.target.checked)}
                          className="rounded accent-purple-500" />
                        <div>
                          <span className="font-semibold block">Auto-Start On Target</span>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>Boots server after successful unpack</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                        <input type="checkbox" checked={transferCleanup} onChange={e => setTransferCleanup(e.target.checked)}
                          className="rounded accent-purple-500" />
                        <div>
                          <span className="font-semibold block">Source Node Cleanup</span>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>Deletes files from old node after verification</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                        <input type="checkbox" checked={transferExcludeLogs} onChange={e => setTransferExcludeLogs(e.target.checked)}
                          className="rounded accent-purple-500" />
                        <div>
                          <span className="font-semibold block">Exclude /logs/</span>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>Skips old server log files</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                        <input type="checkbox" checked={transferExcludeBackups} onChange={e => setTransferExcludeBackups(e.target.checked)}
                          className="rounded accent-purple-500" />
                        <div>
                          <span className="font-semibold block">Exclude /backups/</span>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>Faster migration without heavy archives</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                        <input type="checkbox" checked={transferExcludeCache} onChange={e => setTransferExcludeCache(e.target.checked)}
                          className="rounded accent-purple-500" />
                        <div>
                          <span className="font-semibold block">Exclude .cache</span>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-dim)" }}>Regenerates on startup</span>
                        </div>
                      </label>
                    </div>
                  </Field>

                  {/* Bandwidth Speed Throttle */}
                  <Field label="4. Bandwidth Rate Limit">
                    <select
                      value={transferSpeedMbps}
                      onChange={(e) => setTransferSpeedMbps(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                      style={fieldStyle}
                    >
                      <option value="0">Unlimited (Max Bandwidth Available)</option>
                      <option value="100">100 Mbps (High Speed)</option>
                      <option value="50">50 Mbps (Balanced)</option>
                      <option value="10">10 Mbps (Low Impact Background)</option>
                    </select>
                  </Field>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-between"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <button onClick={() => setTransferServer(null)}
                className="px-4 h-10 rounded-lg text-sm border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                Close
              </button>

              <button
                onClick={executeAdminTransfer}
                disabled={transferSubmitting || !transferTargetNodeId || transferNodes.length === 0}
                className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
              >
                {transferSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Transferring...</>
                ) : (
                  <><ArrowLeftRight className="w-4 h-4" /> Start Migration Pipeline</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteServerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border shadow-xl overflow-hidden"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>
            <div className="p-5 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
              <h2 className="text-xl font-bold" style={{ color: "var(--color-rp-red)" }}>Delete Server</h2>
              <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>This action cannot be undone.</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>Are you sure you want to delete this server?</p>
              <ul className="text-sm list-disc pl-5 space-y-1" style={{ color: "var(--color-rp-text-muted)" }}>
                <li>All server files and worlds will be permanently deleted.</li>
                <li>The server will be removed from the database.</li>
                <li>Allocated ports will be freed up.</li>
              </ul>
            </div>
            <div className="p-5 border-t flex justify-end gap-3" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
              <button onClick={() => setDeleteServerId(null)} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--color-rp-surface)", color: "var(--color-rp-text)", border: "1px solid var(--color-rp-border)" }}>
                Cancel
              </button>
              <button onClick={handleDeleteServer} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--color-rp-red)" }}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? "Deleting..." : "Delete Server"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Quick Port Manager Modal ── */}
      {portModalServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                  style={{ backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: "var(--color-rp-text)" }}>Port Allocation Manager</h2>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                    Manage and allot network ports for <strong>{portModalServer.name}</strong> ({portModalServer.node?.name || "Node"})
                  </p>
                </div>
              </div>
              <button onClick={() => setPortModalServer(null)} style={{ color: "var(--color-rp-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {portModalError && (
                <div className="p-3 rounded-lg text-sm flex items-center gap-2"
                  style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "var(--color-rp-red)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{portModalError}</span>
                </div>
              )}

              {portModalSuccess && (
                <div className="p-3 rounded-lg text-sm flex items-center gap-2"
                  style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "var(--color-rp-green)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{portModalSuccess}</span>
                </div>
              )}

              {/* Quick Actions Header: +1 Port, +2 Ports */}
              <div className="p-4 rounded-xl border space-y-3"
                style={{ borderColor: "var(--color-rp-accent-glow)", backgroundColor: "var(--color-rp-surface)" }}>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                    Quick Allot Extra Port from Node
                  </h4>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
                    Instantly assign the next available open port on this server's node cluster to <strong>{portModalServer.name}</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => quickAssignNextFreePort(1)}
                    disabled={portModalActionLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 shadow"
                    style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
                    {portModalActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>+ Allot 1 Extra Port</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickAssignNextFreePort(2)}
                    disabled={portModalActionLoading}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all hover:bg-white/[0.04] disabled:opacity-50"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                    <Plus className="w-3.5 h-3.5" />
                    <span>+2 Ports</span>
                  </button>
                </div>
              </div>

              {/* Currently Assigned Ports */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-rp-text-muted)" }}>
                    Currently Assigned Ports ({portModalAllocations.length})
                  </p>
                </div>

                {portModalLoading ? (
                  <div className="py-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Loading port allocations...</p>
                  </div>
                ) : portModalAllocations.length === 0 ? (
                  <div className="p-4 rounded-xl border text-center text-xs"
                    style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                    No ports currently assigned.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {portModalAllocations.map((alloc, i) => (
                      <div key={alloc.id || i}
                        className="flex items-center justify-between p-3 rounded-xl border"
                        style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold"
                            style={{ backgroundColor: i === 0 ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.15)", color: i === 0 ? "#34d399" : "#38bdf8" }}>
                            :{alloc.port}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold" style={{ color: "var(--color-rp-text)" }}>
                                {alloc.ip}:{alloc.port}
                              </span>
                              {i === 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                                  Primary Port
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>
                                  Extra / Secondary
                                </span>
                              )}
                            </div>
                            <span className="text-[11px]" style={{ color: "var(--color-rp-text-dim)" }}>
                              {alloc.alias ? `Alias: ${alloc.alias}` : "Direct network binding"}
                            </span>
                          </div>
                        </div>

                        {portModalAllocations.length > 1 && (
                          <button
                            type="button"
                            onClick={() => quickUnassignPort(alloc.id)}
                            disabled={portModalActionLoading}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                            style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--color-rp-red)", backgroundColor: "rgba(239,68,68,0.06)" }}>
                            Unassign Port
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Port Quick Create & Bind */}
              <div className="pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--color-rp-text-muted)" }}>
                  Assign Specific Custom Port
                </p>
                <p className="text-xs mb-3" style={{ color: "var(--color-rp-text-dim)" }}>
                  Type a specific port number (e.g. 25569, 19132, 8080) to bind it directly.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="e.g. 25569"
                    min="1024"
                    max="65535"
                    value={portModalCustomPort}
                    onChange={e => setPortModalCustomPort(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-lg border text-sm outline-none font-mono"
                    style={fieldStyle}
                  />
                  <button
                    type="button"
                    onClick={quickCreateAndAssignCustomPort}
                    disabled={!portModalCustomPort || portModalActionLoading}
                    className="px-4 h-10 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                    style={portModalCustomPort
                      ? { backgroundColor: "#38bdf8", color: "#000" }
                      : { backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-dim)" }}>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Port</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-end"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <button
                type="button"
                onClick={() => setPortModalServer(null)}
                className="px-5 h-10 rounded-lg text-sm font-semibold border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Java Environments Manager Modal ── */}
      {showJavaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-4xl rounded-2xl border overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            style={{ backgroundColor: "var(--color-rp-bg)", borderColor: "var(--color-rp-border)" }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: "var(--color-rp-text)" }}>Java Runtime Environments</h2>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Manage available JDKs, custom Docker images, and node-specific runtime assignments
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateJavaModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Java Version</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowJavaModal(false)}
                  className="p-1.5 rounded-lg border text-sm transition-all hover:opacity-80"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {javaModalError && (
                <div className="p-3 rounded-lg border text-xs flex items-center gap-2"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#f87171" }}>
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{javaModalError}</span>
                </div>
              )}

              {/* Add / Edit Inline Card */}
              <div className="p-4 rounded-xl border space-y-4"
                style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: "var(--color-rp-border)" }}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-rp-text)" }}>
                      {editingJavaVersion ? `Edit Runtime: ${editingJavaVersion.name}` : "Add New Java Runtime Version"}
                    </span>
                  </div>
                  {editingJavaVersion && (
                    <button
                      type="button"
                      onClick={() => { setEditingJavaVersion(null); openCreateJavaModal(); }}
                      className="text-[11px] text-sky-400 hover:underline"
                    >
                      Cancel Edit &amp; Create New
                    </button>
                  )}
                </div>

                {/* Quick Presets */}
                {!editingJavaVersion && (
                  <div>
                    <span className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--color-rp-text-muted)" }}>
                      Quick Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: "Java 21 (Recommended LTS)", version: "21", docker: "eclipse-temurin:21-jre-alpine", desc: "Recommended LTS for 1.20.5+ / 1.21.x" },
                        { name: "Java 17 (LTS)", version: "17", docker: "eclipse-temurin:17-jre-alpine", desc: "Standard LTS for Minecraft 1.17 - 1.20.4" },
                        { name: "Java 11 (LTS)", version: "11", docker: "eclipse-temurin:11-jre-alpine", desc: "Legacy LTS for Minecraft 1.16 - 1.16.5" },
                        { name: "Java 8 (Legacy)", version: "8", docker: "eclipse-temurin:8-jre-alpine", desc: "For Minecraft 1.12.2 and older modpacks" },
                        { name: "Java 21 GraalVM (High Performance)", version: "21-graalvm", docker: "ghcr.io/graalvm/jdk-community:21", desc: "Optimized GraalVM high-performance JIT runtime" },
                        { name: "Java 17 GraalVM", version: "17-graalvm", docker: "ghcr.io/graalvm/jdk-community:17", desc: "High-performance GraalVM runtime for 1.18 - 1.20.4" },
                        { name: "Java 22", version: "22", docker: "eclipse-temurin:22-jdk-alpine", desc: "Adoptium OpenJDK 22 performance release" },
                        { name: "Java 23", version: "23", docker: "eclipse-temurin:23-jdk-alpine", desc: "Adoptium OpenJDK 23 modern runtime" },
                        { name: "Java 25 (Early Access)", version: "25", docker: "eclipse-temurin:25-jdk-alpine", desc: "OpenJDK 25 development preview" },
                        { name: "Amazon Corretto 21", version: "corretto-21", docker: "amazoncorretto:21-alpine", desc: "Amazon Corretto OpenJDK 21" },
                        { name: "Azul Zulu 21", version: "zulu-21", docker: "azul/zulu-openjdk-alpine:21-jre", desc: "Azul Zulu certified OpenJDK 21" },
                      ].map(preset => (
                        <button
                          key={preset.version}
                          type="button"
                          onClick={() => setJavaForm(f => ({
                            ...f,
                            name: preset.name,
                            version: preset.version,
                            dockerImage: preset.docker,
                            description: preset.desc,
                          }))}
                          className="px-2 py-1 rounded-md border text-[11px] font-mono transition-all hover:border-amber-400 hover:text-amber-300"
                          style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-secondary)" }}
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text-secondary)" }}>
                      Display Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Java 21 (LTS)"
                      value={javaForm.name}
                      onChange={e => setJavaForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
                      style={fieldStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text-secondary)" }}>
                      Version Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 21, 17, 11, 8, 21-graalvm"
                      value={javaForm.version}
                      onChange={e => setJavaForm(f => ({ ...f, version: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none font-mono"
                      style={fieldStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text-secondary)" }}>
                      Node Scope
                    </label>
                    <select
                      value={javaForm.nodeId}
                      onChange={e => setJavaForm(f => ({ ...f, nodeId: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
                      style={fieldStyle}
                    >
                      <option value="">Global (Available on all nodes)</option>
                      {nodes.map(n => (
                        <option key={n.id} value={n.id}>Node: {n.name} ({n.fqdn})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text-secondary)" }}>
                      Docker Image (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. eclipse-temurin:21-jre-alpine"
                      value={javaForm.dockerImage}
                      onChange={e => setJavaForm(f => ({ ...f, dockerImage: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none font-mono"
                      style={fieldStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text-secondary)" }}>
                      Binary Path (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. java or /usr/lib/jvm/java-21/bin/java"
                      value={javaForm.binaryPath}
                      onChange={e => setJavaForm(f => ({ ...f, binaryPath: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border text-xs outline-none font-mono"
                      style={fieldStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-rp-text-secondary)" }}>
                    Description &amp; Compatibility Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Recommended for modern Minecraft 1.20.5+ and 1.21.x"
                    value={javaForm.description}
                    onChange={e => setJavaForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
                    style={fieldStyle}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--color-rp-text)" }}>
                    <input
                      type="checkbox"
                      checked={javaForm.isDefault}
                      onChange={e => setJavaForm(f => ({ ...f, isDefault: e.target.checked }))}
                      className="rounded accent-amber-500"
                    />
                    <span>Set as System Default Java Version</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {editingJavaVersion && (
                      <button
                        type="button"
                        onClick={() => { setEditingJavaVersion(null); openCreateJavaModal(); }}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium"
                        style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveJavaVersion}
                      disabled={savingJava}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                    >
                      {savingJava && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{editingJavaVersion ? "Update Java Version" : "Save Java Version"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Runtimes Inventory Table */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-rp-text-muted)" }}>
                  Configured Java Versions ({javaVersions.length})
                </p>

                <div className="rounded-xl border overflow-hidden divide-y"
                  style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
                  {javaVersions.length === 0 ? (
                    <div className="p-8 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
                      <Coffee className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No Java versions configured.</p>
                    </div>
                  ) : (
                    javaVersions.map(jv => (
                      <div key={jv.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                        style={{ borderColor: "var(--color-rp-border)" }}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="min-w-[38px] px-2 h-8 rounded-lg flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono font-bold text-xs shrink-0 whitespace-nowrap">
                            {jv.version}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: "var(--color-rp-text)" }}>
                                {jv.name}
                              </span>
                              {jv.isDefault && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                  Default
                                </span>
                              )}
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700 shrink-0">
                                {jv.node ? `Node: ${jv.node.name}` : "Global"}
                              </span>
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {jv._count?.servers ?? 0} active server(s)
                              </span>
                            </div>
                            <p className="text-[11px] truncate mt-0.5 opacity-70" style={{ color: "var(--color-rp-text-muted)" }}>
                              {jv.description || jv.dockerImage || "Standard Java runtime"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!jv.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultJava(jv.id)}
                              className="px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:opacity-80 flex items-center gap-1"
                              style={{ borderColor: "rgba(245, 158, 11, 0.3)", color: "#fbbf24", backgroundColor: "rgba(245, 158, 11, 0.08)" }}
                              title="Set as Default System Java Runtime"
                            >
                              <Star className="w-3 h-3" />
                              <span>Set Default</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditJavaModal(jv)}
                            className="p-1.5 rounded-lg border text-xs transition-all hover:opacity-80"
                            style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJavaVersion(jv.id)}
                            disabled={deletingJavaId === jv.id}
                            className="p-1.5 rounded-lg border text-xs transition-all hover:opacity-80 disabled:opacity-50"
                            style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--color-rp-red)", backgroundColor: "rgba(239,68,68,0.06)" }}
                            title="Delete"
                          >
                            {deletingJavaId === jv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t flex items-center justify-end shrink-0"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface)" }}>
              <button
                type="button"
                onClick={() => setShowJavaModal(false)}
                className="px-5 h-9 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>{label}</label>
      {children}
      {hint && <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>{hint}</p>}
    </div>
  );
}

export default function ServersPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Loading Servers...</div>}>
      <ServersPageContent />
    </Suspense>
  );
}
