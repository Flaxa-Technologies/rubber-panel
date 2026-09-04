"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, RefreshCw, Copy, AlertCircle, Pencil, Trash2, X, Check, Loader2,
  Zap, Moon, Activity, Server, Cpu, HardDrive, ShieldAlert,
  Radio, Terminal, Info, ChevronRight, CheckCircle2, AlertTriangle, PlayCircle
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Input, Toggle } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { copyToClipboard } from "@/lib/clipboard";

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  location: string | null;
  description: string | null;
  status: string;
  isOnline: boolean;
  maintenanceMode: boolean;
  agentVersion: string | null;
  lastHeartbeat: string | null;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  networkRx?: number | null;
  networkTx?: number | null;
  maxCpu?: number | null;
  maxRam?: number | null;
  maxDisk?: number | null;
  effectiveMaxRam?: number;
  effectiveMaxDisk?: number;
  isAutoRam?: boolean;
  isAutoDisk?: boolean;
  hostTotalRam?: number | null;
  hostUsedRam?: number | null;
  hostTotalDisk?: number | null;
  hostUsedDisk?: number | null;
  serversUsedDisk?: number | null;
  serversUsedRam?: number | null;
  portRangeStart?: number | null;
  portRangeEnd?: number | null;
  autoStartServersOnBoot?: boolean;
  bootCryoSleepMode?: string;
  bootGracePeriodSeconds?: number;
  maxConcurrentBootStarts?: number;
  bootStartupDelaySeconds?: number;
  createdAt: string;
  totalAllocatedRam: number;
  totalAllocatedDisk: number;
  serversRunning: number;
  serversCryo: number;
  serversStopped: number;
  cryoRamSavedMb?: number;
  ramUsedPercent: number;
  ramAllocatedPercent?: number;
  diskUsedPercent: number;
  diskAllocatedPercent?: number;
  isRamWarning: boolean;
  isRamCritical: boolean;
  isRamOverallocated?: boolean;
  isCpuWarning: boolean;
  isDiskWarning: boolean;
  _count: { servers: number; allocations: number };
}

type SetupModalState = {
  nodeId: string;
  name: string;
  token: string;
  setupToken?: string;
  port?: number;
} | null;

// ─── Setup / Connect Node Command Modal ────────────────────────────
function SetupCommandModal({
  data,
  onClose,
}: {
  data: SetupModalState;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [copiedInstant, setCopiedInstant] = useState(false);
  if (!data) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const setupFile = data.setupToken || `ncfg_${data.token}`;
  const quickCmd = `curl -fsSL "${origin}/api/node/configure/${setupFile}" | sudo bash`;
  const directCmd = `curl -sSL https://raw.githubusercontent.com/Flaxa-Technologies/rubber-panel/main/install-node.sh | sudo bash -s -- --admin-url="${origin}" --node-id="${data.nodeId}" --node-token="${data.token}" --port="${data.port || 3001}"`;
  
  const instantEnvCmd = `cat << 'EOF' | sudo tee /var/rubber-panel/node-daemon/.env > /dev/null
NODE_PORT=3001
PORT=3001
AGENT_PORT=3001
ADMIN_API_URL="${origin}"
NODE_TOKEN="${data.token}"
NODE_ID="${data.nodeId}"
DATA_DIR="/var/rubber-panel/servers"
SERVER_DATA_DIR="/var/rubber-panel/servers"
HEARTBEAT_INTERVAL_SECONDS=30
GITHUB_REPO="Flaxa-Technologies/rubber-panel"
EOF
sudo pm2 restart rubber-node --update-env`;

  return (
    <Modal
      open={Boolean(data)}
      onClose={onClose}
      title={`Node Setup — ${data.name}`}
      size="lg"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4">
        {/* Instant Daemon Connect (Direct .env Fix) */}
        <div className="p-4 rounded-xl border" style={{ backgroundColor: "rgba(163,230,53,0.06)", borderColor: "rgba(163,230,53,0.3)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-lime-400" />
              <p className="text-xs font-bold text-lime-400">
                ⚡ Direct Connect / Sync Command (Existing Node)
              </p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-lime-400/20 text-lime-300 border border-lime-400/30">
                Fastest &amp; Instant
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await copyToClipboard(instantEnvCmd);
                setCopiedInstant(true);
                setTimeout(() => setCopiedInstant(false), 3000);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all bg-lime-400 text-black hover:bg-lime-300 shadow-sm">
              {copiedInstant ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedInstant ? "Copied Direct Command!" : "Copy Direct Command"}
            </button>
          </div>
          <p className="text-[11.5px] text-lime-200/90 mb-2.5">
            Run this single command on your node server terminal. It instantly configures <code>/var/rubber-panel/node-daemon/.env</code> with the correct Admin URL, Node ID, and Node Secret Token, and reloads PM2.
          </p>
          <div className="rounded-xl overflow-hidden p-3" style={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(163,230,53,0.25)" }}>
            <code className="text-[11.5px] font-mono select-all break-all whitespace-pre-wrap text-lime-400">
              {instantEnvCmd}
            </code>
          </div>
        </div>

        {/* 1-Click Command */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--color-rp-accent)" }}>
                <Terminal className="w-3.5 h-3.5" />
                <span>1-Click Auto-Configure Installer (Fresh VPS)</span>
              </p>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}>
                Expires in 15 mins
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await copyToClipboard(quickCmd);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied Quick Command!" : "Copy Command"}
            </button>
          </div>
          <div className="rounded-xl overflow-hidden p-3" style={{ backgroundColor: "#0a0a0a", border: "1px solid var(--color-rp-border)" }}>
            <code className="text-[11.5px] font-mono select-all break-all whitespace-pre-wrap" style={{ color: "#a3e635" }}>
              {quickCmd}
            </code>
          </div>
        </div>

        {/* Direct Installer Fallback (Codespaces & Cloudflare Safe) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: "#38bdf8" }}>
              <Terminal className="w-3.5 h-3.5" />
              <span>Direct GitHub Installer (Codespaces &amp; Cloudflare Safe)</span>
            </p>
            <button
              type="button"
              onClick={async () => {
                await copyToClipboard(directCmd);
                setCopiedDirect(true);
                setTimeout(() => setCopiedDirect(false), 3000);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }}>
              {copiedDirect ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedDirect ? "Copied Direct Command!" : "Copy Direct Command"}
            </button>
          </div>
          <div className="rounded-xl overflow-hidden p-3" style={{ backgroundColor: "#0a0a0a", border: "1px solid var(--color-rp-border)" }}>
            <code className="text-[11.5px] font-mono select-all break-all whitespace-pre-wrap" style={{ color: "#38bdf8" }}>
              {directCmd}
            </code>
          </div>
        </div>

        {/* Credentials Cards */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-rp-text-muted)" }}>
            Node Credentials (Manual Setup)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}>
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Admin Panel URL</p>
                <p className="text-xs font-mono font-semibold truncate" style={{ color: "var(--color-rp-text)" }}>{origin}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(origin)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                title="Copy Admin URL"
                style={{ color: "var(--color-rp-text-muted)" }}>
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}>
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Node ID</p>
                <p className="text-xs font-mono font-semibold truncate" style={{ color: "var(--color-rp-text)" }}>{data.nodeId}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(data.nodeId)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                title="Copy Node ID"
                style={{ color: "var(--color-rp-text-muted)" }}>
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 rounded-xl flex items-center justify-between md:col-span-2" style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}>
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Node Auth Token (Secret)</p>
                <p className="text-xs font-mono font-semibold truncate" style={{ color: "#a3e635" }}>{data.token}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(data.token)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                title="Copy Node Token"
                style={{ color: "var(--color-rp-accent)" }}>
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Node Modal ────────────────────────────────────────────────
function AddNodeModal({
  open,
  onClose,
  onCreated,
  onSetupReady,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onSetupReady: (info: SetupModalState) => void;
}) {
  const [form, setForm] = useState({
    name: "", fqdn: "", port: "3001", location: "", description: "",
    maxRam: "", maxDisk: "", portRangeStart: "", portRangeEnd: "",
    autoStartServersOnBoot: false,
    bootCryoSleepMode: "CRYO_HIBERNATE_ALL",
    bootGracePeriodSeconds: "15",
    maxConcurrentBootStarts: "3",
    bootStartupDelaySeconds: "5",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/admin/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, fqdn: form.fqdn, port: parseInt(form.port) || 3001,
        location: form.location || undefined,
        description: form.description || undefined,
        maxRam: form.maxRam ? parseInt(form.maxRam) : undefined,
        maxDisk: form.maxDisk ? parseInt(form.maxDisk) : undefined,
        portRangeStart: form.portRangeStart ? parseInt(form.portRangeStart) : undefined,
        portRangeEnd: form.portRangeEnd ? parseInt(form.portRangeEnd) : undefined,
        autoStartServersOnBoot: form.autoStartServersOnBoot,
        bootCryoSleepMode: form.bootCryoSleepMode,
        bootGracePeriodSeconds: parseInt(form.bootGracePeriodSeconds) || 15,
        maxConcurrentBootStarts: parseInt(form.maxConcurrentBootStarts) || 3,
        bootStartupDelaySeconds: parseInt(form.bootStartupDelaySeconds) || 5,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onCreated();
      onClose();
      onSetupReady({
        nodeId: data.id,
        name: data.name,
        token: data.authToken,
        setupToken: data.setupToken,
        port: data.port,
      });
    } else {
      setError(data.error ?? "Failed to create node");
    }
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Compute Node" description="Register a new hosting node/VPS." size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={handleSubmit as any}>Create Node</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--color-rp-red)" }}>{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Node Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="India-01" />
          <Input label="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Mumbai, India" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="FQDN / IP Address" value={form.fqdn} onChange={e => setForm(f => ({ ...f, fqdn: e.target.value }))} required placeholder="1.2.3.4 or node.example.com" />
          <Input label="Agent Port" type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} required placeholder="3001" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Max RAM (MB)" type="number" value={form.maxRam} onChange={e => setForm(f => ({ ...f, maxRam: e.target.value }))} placeholder="e.g. 32768" hint="Leave blank for unmetered" />
          <Input label="Max Disk (MB)" type="number" value={form.maxDisk} onChange={e => setForm(f => ({ ...f, maxDisk: e.target.value }))} placeholder="e.g. 512000" hint="Leave blank for unmetered" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Port Range Start" type="number" value={form.portRangeStart} onChange={e => setForm(f => ({ ...f, portRangeStart: e.target.value }))} placeholder="25565" />
          <Input label="Port Range End" type="number" value={form.portRangeEnd} onChange={e => setForm(f => ({ ...f, portRangeEnd: e.target.value }))} placeholder="25665" />
        </div>

        {/* Boot & Cryo-Sleep Startup Policy */}
        <div className="p-3.5 rounded-xl border space-y-3" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs font-bold" style={{ color: "var(--color-rp-accent)" }}>
              Node Boot Behavior &amp; Cryo-Sleep Policy
            </span>
          </div>

          <Toggle
            checked={form.autoStartServersOnBoot}
            onChange={() => setForm(f => ({ ...f, autoStartServersOnBoot: !f.autoStartServersOnBoot }))}
            label="Auto-Start Heavy Server Processes on Node Boot / Reboot"
            description="When OFF (recommended), heavy server processes remain stopped to protect node CPU & RAM spikes on boot."
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
              Boot Cryo-Sleep Action
            </label>
            <select
              value={form.bootCryoSleepMode}
              onChange={e => setForm(f => ({ ...f, bootCryoSleepMode: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
            >
              <option value="CRYO_HIBERNATE_ALL">Auto-Arm All Cryo Wake Proxies (0% RAM Mode — Wake on Ping)</option>
              <option value="RESTORE_PREVIOUS">Restore Previous State</option>
              <option value="DO_NOTHING">Keep Stopped / Manual Start</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input label="Max Boot Starts" type="number" value={form.maxConcurrentBootStarts} onChange={e => setForm(f => ({ ...f, maxConcurrentBootStarts: e.target.value }))} hint="Max parallel" />
            <Input label="Stagger Delay (s)" type="number" value={form.bootStartupDelaySeconds} onChange={e => setForm(f => ({ ...f, bootStartupDelaySeconds: e.target.value }))} hint="Secs between starts" />
            <Input label="Grace Period (s)" type="number" value={form.bootGracePeriodSeconds} onChange={e => setForm(f => ({ ...f, bootGracePeriodSeconds: e.target.value }))} hint="Daemon init delay" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Node Modal ───────────────────────────────────────────────
function EditNodeModal({ node, onClose, onSaved }: { node: NodeItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: node.name, fqdn: node.fqdn, port: String(node.port),
    location: node.location ?? "",
    description: node.description ?? "",
    maxRam: node.maxRam ? String(node.maxRam) : "",
    maxDisk: node.maxDisk ? String(node.maxDisk) : "",
    portRangeStart: node.portRangeStart ? String(node.portRangeStart) : "",
    portRangeEnd: node.portRangeEnd ? String(node.portRangeEnd) : "",
    autoStartServersOnBoot: node.autoStartServersOnBoot ?? false,
    bootCryoSleepMode: node.bootCryoSleepMode ?? "CRYO_HIBERNATE_ALL",
    bootGracePeriodSeconds: String(node.bootGracePeriodSeconds ?? 15),
    maxConcurrentBootStarts: String(node.maxConcurrentBootStarts ?? 3),
    bootStartupDelaySeconds: String(node.bootStartupDelaySeconds ?? 5),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    const res = await fetch(`/api/admin/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, fqdn: form.fqdn, port: parseInt(form.port) || 3001,
        location: form.location || undefined,
        description: form.description || undefined,
        maxRam: form.maxRam ? parseInt(form.maxRam) : undefined,
        maxDisk: form.maxDisk ? parseInt(form.maxDisk) : undefined,
        portRangeStart: form.portRangeStart ? parseInt(form.portRangeStart) : undefined,
        portRangeEnd: form.portRangeEnd ? parseInt(form.portRangeEnd) : undefined,
        autoStartServersOnBoot: form.autoStartServersOnBoot,
        bootCryoSleepMode: form.bootCryoSleepMode,
        bootGracePeriodSeconds: parseInt(form.bootGracePeriodSeconds) || 15,
        maxConcurrentBootStarts: parseInt(form.maxConcurrentBootStarts) || 3,
        bootStartupDelaySeconds: parseInt(form.bootStartupDelaySeconds) || 5,
      }),
    });
    if (res.ok) { onSaved(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "Failed to save"); }
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={`Edit Node — ${node.name}`} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>Save Changes</Button></>}>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--color-rp-red)" }}>{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Node Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="FQDN / IP" value={form.fqdn} onChange={e => setForm(f => ({ ...f, fqdn: e.target.value }))} required />
          <Input label="Agent Port" type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Max RAM (MB)" type="number" value={form.maxRam} onChange={e => setForm(f => ({ ...f, maxRam: e.target.value }))} />
          <Input label="Max Disk (MB)" type="number" value={form.maxDisk} onChange={e => setForm(f => ({ ...f, maxDisk: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Port Range Start" type="number" value={form.portRangeStart} onChange={e => setForm(f => ({ ...f, portRangeStart: e.target.value }))} />
          <Input label="Port Range End" type="number" value={form.portRangeEnd} onChange={e => setForm(f => ({ ...f, portRangeEnd: e.target.value }))} />
        </div>

        {/* Boot & Cryo-Sleep Startup Policy */}
        <div className="p-3.5 rounded-xl border space-y-3" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs font-bold" style={{ color: "var(--color-rp-accent)" }}>
              Node Boot Behavior &amp; Cryo-Sleep Policy
            </span>
          </div>

          <Toggle
            checked={form.autoStartServersOnBoot}
            onChange={() => setForm(f => ({ ...f, autoStartServersOnBoot: !f.autoStartServersOnBoot }))}
            label="Auto-Start Heavy Server Processes on Node Boot / Reboot"
            description="When OFF (recommended), heavy server processes remain stopped to protect node CPU & RAM spikes on boot."
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>
              Boot Cryo-Sleep Action
            </label>
            <select
              value={form.bootCryoSleepMode}
              onChange={e => setForm(f => ({ ...f, bootCryoSleepMode: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border text-xs outline-none"
              style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
            >
              <option value="CRYO_HIBERNATE_ALL">Auto-Arm All Cryo Wake Proxies (0% RAM Mode — Wake on Ping)</option>
              <option value="RESTORE_PREVIOUS">Restore Previous State</option>
              <option value="DO_NOTHING">Keep Stopped / Manual Start</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input label="Max Boot Starts" type="number" value={form.maxConcurrentBootStarts} onChange={e => setForm(f => ({ ...f, maxConcurrentBootStarts: e.target.value }))} hint="Max parallel" />
            <Input label="Stagger Delay (s)" type="number" value={form.bootStartupDelaySeconds} onChange={e => setForm(f => ({ ...f, bootStartupDelaySeconds: e.target.value }))} hint="Secs between starts" />
            <Input label="Grace Period (s)" type="number" value={form.bootGracePeriodSeconds} onChange={e => setForm(f => ({ ...f, bootGracePeriodSeconds: e.target.value }))} hint="Daemon init delay" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm ────────────────────────────────────────────────
function DeleteConfirm({ node, onClose, onDeleted }: { node: NodeItem; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setDeleting(true); setError("");
    const res = await fetch(`/api/admin/nodes/${node.id}`, { method: "DELETE" });
    if (res.ok) { onDeleted(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "Failed to delete"); }
    setDeleting(false);
  }

  return (
    <Modal open onClose={onClose} title="Delete Node" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <button onClick={confirm} disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: "var(--color-rp-red)", color: "#fff" }}>
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete Node
        </button>
      </>}>
      <div className="space-y-3">
        {error && <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--color-rp-red)" }}>{error}</div>}
        <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>
          Are you sure you want to delete <strong style={{ color: "var(--color-rp-text)" }}>{node.name}</strong>?
        </p>
        {node._count.servers > 0 && (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "var(--color-rp-red)", border: "1px solid rgba(239,68,68,0.2)" }}>
            This node has {node._count.servers} server(s). Migrate or delete them first.
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>
          All allocations on this node will also be removed. This action cannot be undone.
        </p>
      </div>
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editNode, setEditNode] = useState<NodeItem | null>(null);
  const [deleteNode, setDeleteNode] = useState<NodeItem | null>(null);
  const [setupModal, setSetupModal] = useState<SetupModalState>(null);
  const [pingStates, setPingStates] = useState<Record<string, { loading: boolean; latency?: number; error?: string }>>({});

  const loadNodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/nodes");
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
    const t = setInterval(loadNodes, 10000);
    return () => clearInterval(t);
  }, [loadNodes]);

  async function toggleMaintenance(node: NodeItem) {
    await fetch(`/api/admin/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenanceMode: !node.maintenanceMode }),
    });
    loadNodes();
  }

  async function handleGetSetupCommand(node: NodeItem) {
    try {
      const res = await fetch(`/api/admin/nodes/${node.id}/setup-token`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSetupModal({
          nodeId: data.nodeId,
          name: data.name || node.name,
          token: data.token,
          setupToken: data.setupToken,
          port: data.port,
        });
      }
    } catch {
      // ignore
    }
  }

  async function pingNode(node: NodeItem) {
    setPingStates(p => ({ ...p, [node.id]: { loading: true } }));
    try {
      const res = await fetch(`/api/admin/nodes/${node.id}/ping`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.online) {
        setPingStates(p => ({ ...p, [node.id]: { loading: false, latency: data.latencyMs } }));
        loadNodes();
      } else {
        setPingStates(p => ({ ...p, [node.id]: { loading: false, error: data.error || "Offline" } }));
      }
    } catch {
      setPingStates(p => ({ ...p, [node.id]: { loading: false, error: "Ping failed" } }));
    }
  }

  function timeSince(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  }

  // Fleet Totals Calculations
  const onlineCount = nodes.filter(n => n.status === "ONLINE").length;
  const maintenanceCount = nodes.filter(n => n.maintenanceMode).length;
  const totalServers = nodes.reduce((sum, n) => sum + (n._count?.servers || 0), 0);
  const totalRunningServers = nodes.reduce((sum, n) => sum + (n.serversRunning || 0), 0);
  const totalCryoServers = nodes.reduce((sum, n) => sum + (n.serversCryo || 0), 0);
  const totalCryoRamSavedMb = nodes.reduce((sum, n) => sum + (n.cryoRamSavedMb || 0), 0);
  const totalCryoRamSavedGb = (totalCryoRamSavedMb / 1024).toFixed(1);

  const totalLiveUsedRamMb = nodes.reduce((sum, n) => {
    if (n.hostUsedRam != null) return sum + n.hostUsedRam;
    if (n.hostTotalRam != null) return sum + (n.ramUsage / 100) * n.hostTotalRam;
    return sum + (n.ramUsage / 100) * (n.maxRam || 8192);
  }, 0);
  const totalPhysicalRamMb = nodes.reduce((sum, n) => sum + (n.hostTotalRam || n.effectiveMaxRam || n.maxRam || 8192), 0);
  const totalAllocatedRamMb = nodes.reduce((sum, n) => sum + (n.totalAllocatedRam || 0), 0);
  const totalCapacityRamMb = nodes.reduce((sum, n) => sum + (n.effectiveMaxRam || n.maxRam || 8192), 0);

  const totalLiveUsedRamGb = (totalLiveUsedRamMb / 1024).toFixed(1);
  const totalPhysicalRamGb = (totalPhysicalRamMb / 1024).toFixed(1);
  const totalAllocatedRamGb = (totalAllocatedRamMb / 1024).toFixed(1);
  const totalCapacityRamGb = (totalCapacityRamMb / 1024).toFixed(1);
  const fleetLiveRamPct = totalPhysicalRamMb > 0 ? Math.round((totalLiveUsedRamMb / totalPhysicalRamMb) * 100) : 0;
  const cryoSavingsPercent = totalAllocatedRamMb > 0 ? Math.round((totalCryoRamSavedMb / totalAllocatedRamMb) * 100) : 0;
  const nodesWithWarnings = nodes.filter(n => n.isRamCritical || n.isRamWarning || n.isCpuWarning || n.isDiskWarning).length;

  return (
    <div className="space-y-6 w-full pb-10">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
              Fleet Nodes
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(163,230,53,0.12)", color: "#a3e635", border: "1px solid rgba(163,230,53,0.25)" }}>
              {nodes.length} Compute Nodes
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Real-time compute clusters, memory load telemetry, Cryo-Sleep orchestration &amp; server hosting agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={loadNodes} size="sm">
            Refresh
          </Button>
          <Button icon={Plus} onClick={() => setAddOpen(true)}>
            Add Node
          </Button>
        </div>
      </div>

      {/* Fleet Overview Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border relative overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Fleet Status</p>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-extrabold mt-2 flex items-baseline gap-1.5" style={{ color: "var(--color-rp-text)" }}>
            <span>{onlineCount}</span>
            <span className="text-xs font-normal" style={{ color: "var(--color-rp-text-muted)" }}>/ {nodes.length} Online</span>
          </p>
          <div className="mt-2.5 flex items-center gap-2 text-[11px]">
            {maintenanceCount > 0 && (
              <span className="text-amber-400 font-medium">⚠️ {maintenanceCount} Maintenance</span>
            )}
            {onlineCount === nodes.length && nodes.length > 0 && (
              <span className="text-emerald-400 font-medium">✓ 100% Operational</span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl border relative overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Fleet Memory Load</p>
            <Cpu className="w-4 h-4 text-lime-400" />
          </div>
          <p className="text-xl font-extrabold mt-2 flex items-baseline gap-1.5" style={{ color: "var(--color-rp-text)" }}>
            <span>{totalLiveUsedRamGb}</span>
            <span className="text-xs font-normal" style={{ color: "var(--color-rp-text-muted)" }}>
              / {totalPhysicalRamGb} GB ({fleetLiveRamPct}%)
            </span>
          </p>
          <div className="mt-2.5 text-[11px] flex items-center justify-between" style={{ color: "var(--color-rp-text-muted)" }}>
            <span>Allocated: <strong>{totalAllocatedRamGb} GB</strong> across {totalServers} servers</span>
            {totalAllocatedRamMb > totalCapacityRamMb && (
              <span className="text-[9.5px] px-1.5 py-0.2 rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {Math.round((totalAllocatedRamMb / (totalCapacityRamMb || 1)) * 100)}% Overcommit
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl border relative overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Server Workloads</p>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-extrabold mt-2 flex items-baseline gap-2" style={{ color: "var(--color-rp-text)" }}>
            <span className="text-emerald-400">{totalRunningServers} Active</span>
            <span className="text-cyan-400 text-sm font-semibold">{totalCryoServers} Cryo</span>
          </p>
          <div className="mt-2.5 text-[11px] text-cyan-400/90 flex items-center gap-1">
            <Moon className="w-3 h-3" />
            <span>
              {totalCryoServers > 0
                ? `Cryo-Sleep saving ${totalCryoRamSavedGb} GB (${cryoSavingsPercent}%) RAM on sleep`
                : "Cryo-Sleep active (0 instances in hibernation)"}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border relative overflow-hidden" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Health Alerts</p>
            <ShieldAlert className="w-4 h-4" style={{ color: nodesWithWarnings > 0 ? "#ef4444" : "#22c55e" }} />
          </div>
          <p className="text-xl font-extrabold mt-2" style={{ color: nodesWithWarnings > 0 ? "#ef4444" : "#22c55e" }}>
            {nodesWithWarnings === 0 ? "All Healthy" : `${nodesWithWarnings} Need Attention`}
          </p>
          <div className="mt-2.5 text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
            {nodesWithWarnings === 0 ? "No memory/disk pressure" : "High RAM/CPU detected"}
          </div>
        </div>
      </div>

      {/* Nodes List */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-64 skeleton rounded-2xl" />)}
        </div>
      ) : nodes.length === 0 ? (
        <Card padding="lg">
          <div className="py-14 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(163,230,53,0.1)", color: "#a3e635" }}>
              <Server className="w-6 h-6" />
            </div>
            <p className="text-base font-bold mb-1" style={{ color: "var(--color-rp-text)" }}>No Compute Nodes Connected</p>
            <p className="text-xs mb-5 max-w-md mx-auto" style={{ color: "var(--color-rp-text-muted)" }}>
              Add your first Linux VPS or compute node to automatically start deploying and managing game servers.
            </p>
            <Button icon={Plus} onClick={() => setAddOpen(true)}>Add First Node</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {nodes.map(node => {
            const ping = pingStates[node.id];
            return (
              <div
                key={node.id}
                className="rounded-2xl border transition-all duration-200 overflow-hidden relative flex flex-col justify-between"
                style={{
                  backgroundColor: "var(--color-rp-surface)",
                  borderColor: node.isRamCritical ? "rgba(239,68,68,0.5)" : node.maintenanceMode ? "rgba(234,179,8,0.4)" : "var(--color-rp-border)",
                  boxShadow: node.isRamCritical ? "0 0 20px rgba(239,68,68,0.12)" : "none",
                }}
              >
                {/* Maintenance Mode Warning Strip */}
                {node.maintenanceMode && (
                  <div className="px-4 py-2 text-xs font-semibold flex items-center gap-2" style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "#fbbf24", borderBottom: "1px solid rgba(234,179,8,0.3)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 animate-bounce" />
                    <span>Maintenance Mode Active — New server creation paused. Existing servers restricted.</span>
                  </div>
                )}

                {/* Critical RAM Alert Strip */}
                {node.isRamCritical && !node.maintenanceMode && (
                  <div className="px-4 py-2 text-xs font-bold flex items-center justify-between" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171", borderBottom: "1px solid rgba(239,68,68,0.3)" }}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
                      <span>
                        CRITICAL HOST RAM: {node.ramUsage}% live load ({node.hostUsedRam != null && node.hostTotalRam != null ? `${(node.hostUsedRam / 1024).toFixed(1)} / ${(node.hostTotalRam / 1024).toFixed(1)} GB` : `${node.ramUsage}%`}) — High OOM Risk
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-5 space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base" style={{ color: "var(--color-rp-text)" }}>
                          {node.name}
                        </h3>
                        <StatusBadge status={node.maintenanceMode ? "MAINTENANCE" : node.status} />
                        {node.autoStartServersOnBoot ? (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            <span>Auto-Start</span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-semibold bg-lime-500/15 text-lime-400 border border-lime-500/30 flex items-center gap-1">
                            <Moon className="w-2.5 h-2.5" />
                            <span>Cryo-Arm</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1 font-mono" style={{ color: "var(--color-rp-text-muted)" }}>
                        {node.fqdn}:{node.port}{node.location && <span className="font-sans"> · {node.location}</span>}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-mono" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)" }}>
                        v{node.agentVersion ?? "0.1.0"}
                      </span>
                      <p className="text-[11px] mt-1.5 flex items-center justify-end gap-1 font-medium" style={{ color: node.status === "ONLINE" ? "var(--color-rp-green)" : "var(--color-rp-text-dim)" }}>
                        {node.status === "ONLINE" ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                            <span>Online ({node.lastHeartbeat ? timeSince(node.lastHeartbeat) : "active"})</span>
                          </>
                        ) : (
                          "Agent Offline"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Resource Gauges & Telemetry */}
                  <div className="space-y-3 pt-1">
                    {/* Host Live RAM & Server Allocations */}
                    <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold flex items-center gap-1.5" style={{ color: "var(--color-rp-text)" }}>
                            <Cpu className="w-3.5 h-3.5 text-lime-400" />
                            <span>Host RAM (Live Load)</span>
                          </span>
                          <span
                            className="font-mono text-xs font-bold"
                            style={{
                              color: node.isRamCritical ? "#ef4444" : node.isRamWarning ? "#f59e0b" : "var(--color-rp-text)",
                            }}
                          >
                            {node.hostUsedRam != null && node.hostTotalRam != null
                              ? `${(node.hostUsedRam / 1024).toFixed(1)} / ${(node.hostTotalRam / 1024).toFixed(1)} GB (${node.ramUsage}%)`
                              : `${node.ramUsage}%`}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden bg-white/5">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(3, node.ramUsage))}%`,
                              backgroundColor: node.isRamCritical ? "#ef4444" : node.isRamWarning ? "#f59e0b" : "#a3e635",
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10.5px]" style={{ color: "var(--color-rp-text-muted)" }}>Server Allocations:</span>
                          <strong className="font-mono" style={{ color: "var(--color-rp-text)" }}>{(node.totalAllocatedRam / 1024).toFixed(1)} GB</strong>
                          <span className="text-[10px]" style={{ color: "var(--color-rp-text-muted)" }}>
                            / {((node.effectiveMaxRam || node.maxRam || 8192) / 1024).toFixed(1)} GB Cap
                          </span>
                          {node.isAutoRam && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded font-medium bg-lime-500/10 text-lime-400 border border-lime-500/20">
                              Auto (HW - 1GB)
                            </span>
                          )}
                        </div>
                        <div>
                          {node.totalAllocatedRam > (node.effectiveMaxRam || 8192) ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              {Math.round((node.totalAllocatedRam / (node.effectiveMaxRam || 8192)) * 100)}% Overcommitted
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
                              {Math.round((node.totalAllocatedRam / ((node.effectiveMaxRam || node.maxRam || 8192) || 1)) * 100)}% Allocated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CPU & Disk Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* CPU */}
                      <div className="p-2.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Host CPU Load</span>
                          <span className="font-mono font-bold" style={{ color: node.cpuUsage > 85 ? "#ef4444" : "var(--color-rp-text)" }}>{node.cpuUsage}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(2, node.cpuUsage))}%`, backgroundColor: node.cpuUsage > 85 ? "#ef4444" : "#38bdf8" }} />
                        </div>
                        <div className="text-[10px] mt-1.5 flex justify-between" style={{ color: "var(--color-rp-text-muted)" }}>
                          <span>Entire Host Activity</span>
                          <span className="font-mono">{node.cpuUsage > 50 ? "Heavy" : "Normal"}</span>
                        </div>
                      </div>

                      {/* Disk */}
                      <div className="p-2.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Host &amp; Server Disk</span>
                          <span className="font-mono font-bold" style={{ color: node.diskUsage > 85 ? "#ef4444" : "var(--color-rp-text)" }}>
                            {node.hostUsedDisk != null && node.hostTotalDisk != null ? `${(node.hostUsedDisk / 1024).toFixed(0)} / ${(node.hostTotalDisk / 1024).toFixed(0)} GB` : `${node.diskUsage}%`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(2, node.diskUsage))}%`, backgroundColor: node.diskUsage > 85 ? "#ef4444" : "#a855f7" }} />
                        </div>
                        <div className="flex justify-between text-[10px] mt-1.5" style={{ color: "var(--color-rp-text-muted)" }}>
                          <span>Host: {node.diskUsage}%</span>
                          <span>Game Data: {node.serversUsedDisk ? `${(node.serversUsedDisk / 1024).toFixed(1)} GB` : `${(node.totalAllocatedDisk / 1024).toFixed(1)} GB`}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Server Breakdown Pills */}
                  <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                    <div className="p-2 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <p className="text-base font-extrabold" style={{ color: "var(--color-rp-text)" }}>{node._count.servers}</p>
                      <p className="text-[10px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Total Servers</p>
                    </div>
                    <div className="p-2 rounded-xl border" style={{ backgroundColor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.2)" }}>
                      <p className="text-base font-extrabold text-emerald-400">{node.serversRunning}</p>
                      <p className="text-[10px] font-medium text-emerald-400/80">Running</p>
                    </div>
                    <div className="p-2 rounded-xl border" style={{ backgroundColor: "rgba(56,189,248,0.06)", borderColor: "rgba(56,189,248,0.2)" }}>
                      <p className="text-base font-extrabold text-cyan-400">{node.serversCryo}</p>
                      <p className="text-[10px] font-medium text-cyan-400/80">Cryo Sleep</p>
                    </div>
                    <div className="p-2 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                      <p className="text-base font-extrabold" style={{ color: "var(--color-rp-text-muted)" }}>{node.serversStopped}</p>
                      <p className="text-[10px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Stopped</p>
                    </div>
                  </div>
                </div>

                {/* Footer Controls & Quick Actions */}
                <div className="px-5 py-3.5 border-t flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={node.maintenanceMode}
                      onChange={() => toggleMaintenance(node)}
                      label="Maintenance Mode"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Ping / Test Latency */}
                    <button
                      type="button"
                      onClick={() => pingNode(node)}
                      disabled={ping?.loading}
                      title="Test Agent Heartbeat & Round-trip Latency"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:bg-white/5"
                      style={{
                        borderColor: ping?.latency !== undefined ? "rgba(34,197,94,0.4)" : "var(--color-rp-border)",
                        color: ping?.latency !== undefined ? "#22c55e" : "var(--color-rp-text-muted)",
                      }}
                    >
                      {ping?.loading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-lime-400" />
                      ) : (
                        <Activity className="w-3 h-3" />
                      )}
                      <span>{ping?.loading ? "Pinging..." : ping?.latency !== undefined ? `${ping.latency}ms (OK)` : ping?.error ? "Ping Failed" : "Ping"}</span>
                    </button>

                    {/* Setup Command Modal */}
                    <button
                      type="button"
                      onClick={() => handleGetSetupCommand(node)}
                      title="Generate 1-Click Auto-Configure Link"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:bg-white/5"
                      style={{ borderColor: "var(--color-rp-border)", color: "#a3e635" }}
                    >
                      <Terminal className="w-3 h-3" />
                      <span>Setup Link</span>
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => setEditNode(node)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-white/[0.04]"
                      style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setDeleteNode(node)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-red-500/10"
                      style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--color-rp-red)" }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddNodeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={loadNodes}
        onSetupReady={info => setSetupModal(info)}
      />

      {editNode && (
        <EditNodeModal
          node={editNode}
          onClose={() => setEditNode(null)}
          onSaved={loadNodes}
        />
      )}

      {deleteNode && (
        <DeleteConfirm
          node={deleteNode}
          onClose={() => setDeleteNode(null)}
          onDeleted={loadNodes}
        />
      )}

      {setupModal && (
        <SetupCommandModal
          data={setupModal}
          onClose={() => setSetupModal(null)}
        />
      )}
    </div>
  );
}
