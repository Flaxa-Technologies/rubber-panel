"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, RefreshCw, Copy, AlertCircle, Pencil, Trash2, X, Check, Loader2, Zap, Moon, Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Input, Toggle } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ResourceBar } from "@/components/ui/ResourceBar";

interface Node {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  location: string | null;
  status: string;
  maintenanceMode: boolean;
  agentVersion: string | null;
  lastHeartbeat: string | null;
  cpuUsage: number | null;
  ramUsage: number | null;
  diskUsage: number | null;
  maxCpu: number | null;
  maxRam: number | null;
  maxDisk: number | null;
  portRangeStart: number | null;
  portRangeEnd: number | null;
  autoStartServersOnBoot?: boolean;
  bootCryoSleepMode?: string;
  bootGracePeriodSeconds?: number;
  maxConcurrentBootStarts?: number;
  bootStartupDelaySeconds?: number;
  createdAt: string;
  _count: { servers: number; allocations: number };
}

type NewTokenState = { token: string; nodeId: string; setupToken?: string } | null;

// ─── Add Node Modal ────────────────────────────────────────────────
function AddNodeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    fqdn: "",
    port: "3001",
    location: "",
    description: "",
    maxRam: "",
    maxDisk: "",
    portRangeStart: "",
    portRangeEnd: "",
    autoStartServersOnBoot: false,
    bootCryoSleepMode: "CRYO_HIBERNATE_ALL",
    bootGracePeriodSeconds: "15",
    maxConcurrentBootStarts: "3",
    bootStartupDelaySeconds: "5",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newToken, setNewToken] = useState<NewTokenState>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/admin/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, fqdn: form.fqdn, port: parseInt(form.port),
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
      setNewToken({ token: data.authToken, nodeId: data.id, setupToken: data.setupToken });
      onCreated();
    } else {
      setError(data.error ?? "Failed to create node");
    }
    setLoading(false);
  }

  function handleClose() {
    setNewToken(null); setCopied(false);
    setForm({
      name: "", fqdn: "", port: "3001", location: "", description: "", maxRam: "", maxDisk: "",
      portRangeStart: "", portRangeEnd: "",
      autoStartServersOnBoot: false,
      bootCryoSleepMode: "CRYO_HIBERNATE_ALL",
      bootGracePeriodSeconds: "15",
      maxConcurrentBootStarts: "3",
      bootStartupDelaySeconds: "5",
    });
    onClose();
  }

  if (newToken) {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const setupFile = newToken.setupToken ? `${newToken.setupToken}.sh` : `ncfg_${newToken.token}.sh`;
    const quickCmd = `curl -sSL "${origin}/api/node/configure/${setupFile}" | sudo bash`;

    return (
      <Modal open={open} onClose={handleClose} title="Node Registered — 1-Click Deployment" size="lg"
        footer={<Button onClick={handleClose}>Done</Button>}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#22c55e" }} />
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-rp-text)" }}>
              <strong>Node created successfully!</strong> Run the 1-Line command below on your VPS or Codespace. It automatically writes credentials, reloads PM2, and connects the daemon in seconds.
            </p>
          </div>

          {/* Quick Auto-Deploy Command */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--color-rp-accent)" }}>
                  <Zap className="w-3.5 h-3.5" />
                  <span>1-Click Auto-Configure Command</span>
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}>
                  Expires in 15 mins
                </span>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(quickCmd); setCopied(true); setTimeout(() => setCopied(false), 3000); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all"
                style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied 1-Line Command!" : "Copy Command"}
              </button>
            </div>
            <div className="rounded-xl overflow-hidden p-3" style={{ backgroundColor: "#0a0a0a", border: "1px solid var(--color-rp-border)" }}>
              <code className="text-[11.5px] font-mono select-all break-all whitespace-pre-wrap" style={{ color: "#a3e635" }}>
                {quickCmd}
              </code>
            </div>
          </div>

          {/* Connection Parameters Cards */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-rp-text-muted)" }}>
              Node Connection Parameters
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* Admin URL */}
              <div className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}>
                <div className="min-w-0 pr-2">
                  <p className="text-[11px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Admin Panel URL</p>
                  <p className="text-xs font-mono font-semibold truncate" style={{ color: "var(--color-rp-text)" }}>{origin}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(origin)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                  title="Copy Admin URL"
                  style={{ color: "var(--color-rp-text-muted)" }}>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Node ID */}
              <div className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}>
                <div className="min-w-0 pr-2">
                  <p className="text-[11px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Node ID</p>
                  <p className="text-xs font-mono font-semibold truncate" style={{ color: "var(--color-rp-text)" }}>{newToken.nodeId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(newToken.nodeId)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                  title="Copy Node ID"
                  style={{ color: "var(--color-rp-text-muted)" }}>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Node Auth Token */}
              <div className="p-3 rounded-xl flex items-center justify-between md:col-span-2" style={{ backgroundColor: "var(--color-rp-surface)", border: "1px solid var(--color-rp-border)" }}>
                <div className="min-w-0 pr-2">
                  <p className="text-[11px] font-medium" style={{ color: "var(--color-rp-text-muted)" }}>Node Auth Token (Secret)</p>
                  <p className="text-xs font-mono font-semibold truncate" style={{ color: "#a3e635" }}>{newToken.token}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(newToken.token)}
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

  return (
    <Modal open={open} onClose={handleClose} title="Add Node" description="Register a new hosting node/VPS." size="lg"
      footer={<><Button variant="secondary" onClick={handleClose}>Cancel</Button><Button loading={loading} onClick={handleSubmit as any}>Create Node</Button></>}>
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
          <Input label="Max RAM (MB)" type="number" value={form.maxRam} onChange={e => setForm(f => ({ ...f, maxRam: e.target.value }))} placeholder="e.g. 32768" />
          <Input label="Max Disk (MB)" type="number" value={form.maxDisk} onChange={e => setForm(f => ({ ...f, maxDisk: e.target.value }))} placeholder="e.g. 512000" />
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
            <Input
              label="Max Boot Starts"
              type="number"
              value={form.maxConcurrentBootStarts}
              onChange={e => setForm(f => ({ ...f, maxConcurrentBootStarts: e.target.value }))}
              hint="Max parallel boots"
            />
            <Input
              label="Stagger Delay (s)"
              type="number"
              value={form.bootStartupDelaySeconds}
              onChange={e => setForm(f => ({ ...f, bootStartupDelaySeconds: e.target.value }))}
              hint="Seconds between starts"
            />
            <Input
              label="Grace Period (s)"
              type="number"
              value={form.bootGracePeriodSeconds}
              onChange={e => setForm(f => ({ ...f, bootGracePeriodSeconds: e.target.value }))}
              hint="Daemon init delay"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Node Modal ───────────────────────────────────────────────
function EditNodeModal({ node, onClose, onSaved }: { node: Node; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: node.name, fqdn: node.fqdn, port: String(node.port),
    location: node.location ?? "",
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
        name: form.name, fqdn: form.fqdn, port: parseInt(form.port),
        location: form.location || undefined,
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
            <Input
              label="Max Boot Starts"
              type="number"
              value={form.maxConcurrentBootStarts}
              onChange={e => setForm(f => ({ ...f, maxConcurrentBootStarts: e.target.value }))}
              hint="Max parallel boots"
            />
            <Input
              label="Stagger Delay (s)"
              type="number"
              value={form.bootStartupDelaySeconds}
              onChange={e => setForm(f => ({ ...f, bootStartupDelaySeconds: e.target.value }))}
              hint="Seconds between starts"
            />
            <Input
              label="Grace Period (s)"
              type="number"
              value={form.bootGracePeriodSeconds}
              onChange={e => setForm(f => ({ ...f, bootGracePeriodSeconds: e.target.value }))}
              hint="Daemon init delay"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm ────────────────────────────────────────────────
function DeleteConfirm({ node, onClose, onDeleted }: { node: Node; onClose: () => void; onDeleted: () => void }) {
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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const [deleteNode, setDeleteNode] = useState<Node | null>(null);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/nodes");
    if (res.ok) { const data = await res.json(); setNodes(data.nodes); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNodes();
    // Auto-refresh every 15s so status updates appear
    const t = setInterval(loadNodes, 15000);
    return () => clearInterval(t);
  }, [loadNodes]);

  async function toggleMaintenance(node: Node) {
    await fetch(`/api/admin/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenanceMode: !node.maintenanceMode }),
    });
    loadNodes();
  }

  function timeSince(date: string) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>Nodes</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            {nodes.length} registered · {nodes.filter(n => n.status === "ONLINE").length} online · auto-refreshes every 15s
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={loadNodes} size="sm">Refresh</Button>
          <Button icon={Plus} onClick={() => setAddOpen(true)}>Add Node</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-56 skeleton rounded-xl" />)}
        </div>
      ) : nodes.length === 0 ? (
        <Card padding="lg">
          <div className="py-12 text-center">
            <p className="font-medium mb-1" style={{ color: "var(--color-rp-text)" }}>No nodes registered</p>
            <p className="text-sm mb-4" style={{ color: "var(--color-rp-text-muted)" }}>Add a hosting node to start deploying servers.</p>
            <Button icon={Plus} onClick={() => setAddOpen(true)}>Add First Node</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {nodes.map(node => (
            <Card key={node.id}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold" style={{ color: "var(--color-rp-text)" }}>{node.name}</h3>
                    <StatusBadge status={node.maintenanceMode ? "MAINTENANCE" : node.status} />
                    {node.autoStartServersOnBoot ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        <span>Auto-Start</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-lime-500/15 text-lime-400 border border-lime-500/30 flex items-center gap-1">
                        <Moon className="w-2.5 h-2.5" />
                        <span>Cryo-Arm</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                    {node.fqdn}:{node.port}{node.location && ` · ${node.location}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Agent v{node.agentVersion ?? "—"}
                  </p>
                  <p className="text-xs mt-1 flex items-center justify-end gap-1" style={{ color: node.lastHeartbeat ? "var(--color-rp-green)" : "var(--color-rp-text-dim)" }}>
                    {node.lastHeartbeat ? (
                      <>
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span>{timeSince(node.lastHeartbeat)}</span>
                      </>
                    ) : (
                      "Never connected"
                    )}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--color-rp-text)" }}>{node._count.servers}</p>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Servers</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--color-rp-text)" }}>{node._count.allocations}</p>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Allocations</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--color-rp-text)" }}>
                    {node.maxRam ? `${(node.maxRam / 1024).toFixed(0)}GB` : "—"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Max RAM</p>
                </div>
              </div>

              {/* Resource bars — only when online */}
              {node.status === "ONLINE" && (
                <div className="space-y-2 mb-4">
                  <ResourceBar label="CPU" used={node.cpuUsage ?? 0} unit="%" />
                  <ResourceBar label="RAM" used={node.ramUsage ?? 0} unit="%" />
                  <ResourceBar label="Disk" used={node.diskUsage ?? 0} unit="%" />
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <Toggle
                  checked={node.maintenanceMode}
                  onChange={() => toggleMaintenance(node)}
                  label="Maintenance"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditNode(node)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-white/[0.04]"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteNode(node)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-red-500/10"
                    style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--color-rp-red)" }}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddNodeModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={loadNodes} />
      {editNode && <EditNodeModal node={editNode} onClose={() => setEditNode(null)} onSaved={loadNodes} />}
      {deleteNode && <DeleteConfirm node={deleteNode} onClose={() => setDeleteNode(null)} onDeleted={loadNodes} />}
    </div>
  );
}
