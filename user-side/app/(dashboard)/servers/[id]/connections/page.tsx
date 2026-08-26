"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Webhook, Plus, Send, Trash2, Edit2, Check, X, AlertCircle,
  Loader2, CheckCircle2, ToggleLeft, ToggleRight, Radio, Bell
} from "lucide-react";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface ServerWebhookItem {
  id: string;
  name: string;
  url: string;
  events: string;
  enabled: boolean;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  { key: "server.start", label: "Server Started", desc: "Fired when the instance container successfully boots" },
  { key: "server.stop", label: "Server Stopped", desc: "Fired when the instance is gracefully shut down" },
  { key: "server.crash", label: "Server Crashed", desc: "Fired when the server process exits unexpectedly" },
  { key: "server.restart", label: "Server Restarting", desc: "Fired when an automated or manual reboot is triggered" },
  { key: "backup.create", label: "Backup Created", desc: "Fired when an automated or manual backup finishes" },
];

export default function ServerConnectionsPage() {
  const { id } = useParams<{ id: string }>();

  const [webhooks, setWebhooks] = useState<ServerWebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["server.start", "server.stop", "server.crash"]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // Test State
  const [testingId, setTestingId] = useState<string | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<ServerWebhookItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadWebhooks() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${id}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load webhooks.");
      }
    } catch {
      setError("Network error loading webhooks.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadWebhooks();
  }, [id]);

  function openCreateModal() {
    setEditingId(null);
    setFormName("Discord Server Notifications");
    setFormUrl("");
    setFormEvents(["server.start", "server.stop", "server.crash"]);
    setFormEnabled(true);
    setModalOpen(true);
  }

  function openEditModal(hook: ServerWebhookItem) {
    setEditingId(hook.id);
    setFormName(hook.name);
    setFormUrl(hook.url);
    try {
      setFormEvents(JSON.parse(hook.events));
    } catch {
      setFormEvents(["server.start", "server.stop", "server.crash"]);
    }
    setFormEnabled(hook.enabled);
    setModalOpen(true);
  }

  function toggleEvent(key: string) {
    setFormEvents(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) return;
    setSaving(true);
    setError("");

    try {
      const url = editingId
        ? `/api/user/servers/${id}/webhooks/${editingId}`
        : `/api/user/servers/${id}/webhooks`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          url: formUrl.trim(),
          events: formEvents,
          enabled: formEnabled,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setSuccess(editingId ? "Webhook updated successfully." : "Webhook created successfully.");
        setTimeout(() => setSuccess(""), 3500);
        loadWebhooks();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to save webhook.");
      }
    } catch {
      setError("Network error saving webhook.");
    }
    setSaving(false);
  }

  async function handleTest(hook: ServerWebhookItem) {
    setTestingId(hook.id);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${id}/webhooks/${hook.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Test notification sent to "${hook.name}" successfully!`);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Test dispatch failed.");
      }
    } catch {
      setError("Network error triggering test payload.");
    }
    setTestingId(null);
  }

  async function toggleEnabled(hook: ServerWebhookItem) {
    try {
      const res = await fetch(`/api/user/servers/${id}/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !hook.enabled }),
      });
      if (res.ok) {
        loadWebhooks();
      }
    } catch {}
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/servers/${id}/webhooks/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        setSuccess("Webhook deleted.");
        setTimeout(() => setSuccess(""), 3500);
        loadWebhooks();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to delete webhook.");
      }
    } catch {
      setError("Network error deleting webhook.");
    }
    setDeleting(false);
  }

  function maskUrl(url: string) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}/...${url.slice(-8)}`;
    } catch {
      return url.slice(0, 20) + "..." + url.slice(-6);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Card */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Webhook size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              Connections &amp; Webhooks
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Connect Discord, Slack, or custom HTTP endpoints to receive instant alerts when your server starts, stops, or crashes.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-solid-white"
          style={{ padding: "7px 14px", fontSize: 12.5 }}
        >
          <Plus size={14} />
          <span>Add Webhook</span>
        </button>
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

      {/* Webhooks List */}
      {loading ? (
        <div className="saas-card" style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={22} className="spin" style={{ margin: "0 auto", color: "var(--text-muted)" }} />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="saas-card" style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>
          <Radio size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-pure)" }}>No webhooks configured</h3>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, maxWidth: 440, margin: "4px auto 16px" }}>
            Add a Discord webhook URL to get real-time embeds directly in your server channel.
          </p>
          <button onClick={openCreateModal} className="btn-solid-white" style={{ padding: "7px 16px", fontSize: 12.5 }}>
            <Plus size={13} />
            <span>Add Your First Webhook</span>
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {webhooks.map((hook) => {
            let eventsList: string[] = [];
            try {
              eventsList = JSON.parse(hook.events);
            } catch {
              eventsList = [];
            }

            return (
              <div
                key={hook.id}
                className="saas-card"
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  opacity: hook.enabled ? 1 : 0.65,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                        {hook.name}
                      </h3>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: hook.enabled ? "rgba(16,185,129,0.15)" : "var(--bg-surface-elevated)",
                          color: hook.enabled ? "#34d399" : "var(--text-muted)",
                          border: hook.enabled ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-medium)",
                        }}
                      >
                        {hook.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 4 }}>
                      {maskUrl(hook.url)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => handleTest(hook)}
                      disabled={testingId === hook.id}
                      className="btn-solid-white"
                      style={{ padding: "5px 12px", fontSize: 12 }}
                      title="Send Test Notification"
                    >
                      {testingId === hook.id ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
                      <span>{testingId === hook.id ? "Sending..." : "Test"}</span>
                    </button>

                    <button
                      onClick={() => toggleEnabled(hook)}
                      className="btn-secondary-dark"
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      title={hook.enabled ? "Disable Webhook" : "Enable Webhook"}
                    >
                      {hook.enabled ? <ToggleRight size={14} style={{ color: "var(--status-online)" }} /> : <ToggleLeft size={14} />}
                      <span>{hook.enabled ? "Active" : "Paused"}</span>
                    </button>

                    <button
                      onClick={() => openEditModal(hook)}
                      className="btn-secondary-dark"
                      style={{ padding: "5px 8px" }}
                      title="Edit Webhook"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      onClick={() => setDeleteTarget(hook)}
                      className="btn-secondary-dark"
                      style={{ padding: "5px 8px", color: "#f87171" }}
                      title="Delete Webhook"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Subscribed Events Pills */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                    Events:
                  </span>
                  {eventsList.map((evt) => (
                    <span
                      key={evt}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {evt}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-box" style={{ maxWidth: 580, background: "var(--bg-surface)", border: "1px solid var(--border-medium)" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Webhook size={15} style={{ color: "var(--text-pure)" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    {editingId ? "Edit Webhook" : "Add Webhook"}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Subscribe to instance lifecycle event triggers</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(90vh - 130px)" }}>
                {/* Webhook Name */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Webhook Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Discord Staff Alerts"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="saas-input"
                  />
                </div>

                {/* Webhook URL */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Webhook Target URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://discord.com/api/webhooks/..."
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="saas-input"
                  />
                </div>

                {/* Subscribed Events */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 8 }}>
                    Event Subscriptions ({formEvents.length} selected)
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {AVAILABLE_EVENTS.map((evt) => {
                      const active = formEvents.includes(evt.key);
                      return (
                        <label
                          key={evt.key}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "8px 12px",
                            borderRadius: "var(--radius-sm)",
                            background: active ? "var(--bg-surface-hover)" : "var(--bg-surface-elevated)",
                            border: active ? "1px solid var(--border-medium)" : "1px solid var(--border-subtle)",
                            cursor: "pointer",
                            transition: "all 0.1s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleEvent(evt.key)}
                            style={{ accentColor: "#ffffff", marginTop: 3, cursor: "pointer" }}
                          />
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? "var(--text-pure)" : "var(--text-secondary)" }}>
                              {evt.label}
                            </span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                              {evt.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Enabled Toggle */}
                <div style={{ padding: "10px 14px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                      style={{ accentColor: "#ffffff", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span>Enable this webhook immediately</span>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary-dark"
                  style={{ padding: "7px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-solid-white"
                  style={{ padding: "7px 16px" }}
                >
                  {saving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                  <span>{saving ? "Saving..." : editingId ? "Update Webhook" : "Save Webhook"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Webhook"
        description={`Are you sure you want to delete webhook "${deleteTarget?.name}"?`}
        confirmLabel="Delete Webhook"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
