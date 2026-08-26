"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Clock, Plus, Play, Trash2, Edit2, Check, X, AlertCircle,
  Loader2, CheckCircle2, Terminal, Zap, Archive,
  Calendar, ArrowRight, ToggleLeft, ToggleRight
} from "lucide-react";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface ScheduleTask {
  id?: string;
  sequence: number;
  action: "COMMAND" | "POWER" | "BACKUP";
  payload: string;
  timeOffset: number;
}

interface Schedule {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  onlyWhenOnline: boolean;
  lastRunAt: string | null;
  createdAt: string;
  tasks: ScheduleTask[];
}

const CRON_PRESETS = [
  { label: "Every 5 Min", cron: "*/5 * * * *", desc: "Every 5 minutes continuously" },
  { label: "Every 15 Min", cron: "*/15 * * * *", desc: "Every 15 minutes" },
  { label: "Every Hour", cron: "0 * * * *", desc: "At the start of every hour" },
  { label: "Daily (Midnight)", cron: "0 0 * * *", desc: "Every day at 00:00 UTC" },
  { label: "Daily (4 AM)", cron: "0 4 * * *", desc: "Every day at 04:00 UTC" },
  { label: "Weekly (Sunday)", cron: "0 0 * * 0", desc: "Every Sunday at midnight" },
];

export default function ServerSchedulesPage() {
  const { id } = useParams<{ id: string }>();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCron, setFormCron] = useState("0 0 * * *");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formOnlyOnline, setFormOnlyOnline] = useState(true);
  const [formTasks, setFormTasks] = useState<ScheduleTask[]>([
    { sequence: 1, action: "COMMAND", payload: "say [Server] Automated save and restart in 30 seconds!", timeOffset: 0 },
    { sequence: 2, action: "POWER", payload: "restart", timeOffset: 30 },
  ]);
  const [saving, setSaving] = useState(false);

  // Triggering State
  const [runningId, setRunningId] = useState<string | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadSchedules() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${id}/schedules`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load schedules.");
      }
    } catch {
      setError("Failed to connect to schedules API.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSchedules();
  }, [id]);

  function openCreateModal() {
    setEditingId(null);
    setFormName("Daily Auto Restart & Backup");
    setFormCron("0 0 * * *");
    setFormEnabled(true);
    setFormOnlyOnline(true);
    setFormTasks([
      { sequence: 1, action: "COMMAND", payload: "say [Server] Automated restart in 30 seconds!", timeOffset: 0 },
      { sequence: 2, action: "POWER", payload: "restart", timeOffset: 30 },
    ]);
    setModalOpen(true);
  }

  function openEditModal(sch: Schedule) {
    setEditingId(sch.id);
    setFormName(sch.name);
    setFormCron(sch.cron);
    setFormEnabled(sch.enabled);
    setFormOnlyOnline(sch.onlyWhenOnline);
    setFormTasks(
      sch.tasks.length > 0
        ? sch.tasks.map((t, i) => ({ sequence: i + 1, action: t.action, payload: t.payload, timeOffset: t.timeOffset }))
        : [{ sequence: 1, action: "COMMAND", payload: "say Hello!", timeOffset: 0 }]
    );
    setModalOpen(true);
  }

  function addTask() {
    setFormTasks(prev => [
      ...prev,
      { sequence: prev.length + 1, action: "COMMAND", payload: "", timeOffset: 10 },
    ]);
  }

  function removeTask(index: number) {
    setFormTasks(prev => prev.filter((_, i) => i !== index));
  }

  function updateTask(index: number, field: keyof ScheduleTask, value: any) {
    setFormTasks(prev =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formCron.trim()) return;
    setSaving(true);
    setError("");

    try {
      const url = editingId
        ? `/api/user/servers/${id}/schedules/${editingId}`
        : `/api/user/servers/${id}/schedules`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          cron: formCron.trim(),
          enabled: formEnabled,
          onlyWhenOnline: formOnlyOnline,
          tasks: formTasks,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setSuccess(editingId ? "Schedule updated successfully." : "Schedule created successfully.");
        setTimeout(() => setSuccess(""), 3500);
        loadSchedules();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to save schedule.");
      }
    } catch {
      setError("Network error saving schedule.");
    }
    setSaving(false);
  }

  async function toggleScheduleEnabled(sch: Schedule) {
    try {
      const res = await fetch(`/api/user/servers/${id}/schedules/${sch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !sch.enabled }),
      });
      if (res.ok) {
        loadSchedules();
      }
    } catch {}
  }

  async function triggerSchedule(sch: Schedule) {
    setRunningId(sch.id);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${id}/schedules/${sch.id}/execute`, {
        method: "POST",
      });
      if (res.ok) {
        setSuccess(`Triggered schedule "${sch.name}". Tasks executing.`);
        setTimeout(() => setSuccess(""), 3500);
        loadSchedules();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to execute schedule.");
      }
    } catch {
      setError("Network error executing schedule.");
    }
    setRunningId(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/servers/${id}/schedules/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        setSuccess("Schedule deleted.");
        setTimeout(() => setSuccess(""), 3500);
        loadSchedules();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to delete schedule.");
      }
    } catch {
      setError("Network error deleting schedule.");
    }
    setDeleting(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Header Card */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              Automation &amp; Schedules
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Create automated recurring tasks to run console commands, reboot the instance, or take backups at specific intervals.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-solid-white"
          style={{ padding: "7px 14px", fontSize: 12.5 }}
        >
          <Plus size={14} />
          <span>Create Schedule</span>
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

      {/* Schedules List */}
      {loading ? (
        <div className="saas-card" style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={22} className="spin" style={{ margin: "0 auto", color: "var(--text-muted)" }} />
        </div>
      ) : schedules.length === 0 ? (
        <div className="saas-card" style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>
          <Calendar size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-pure)" }}>No active schedules configured</h3>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, maxWidth: 440, margin: "4px auto 16px" }}>
            Automate server tasks like periodic announcements, automatic restarts, and scheduled world backups.
          </p>
          <button onClick={openCreateModal} className="btn-solid-white" style={{ padding: "7px 16px", fontSize: 12.5 }}>
            <Plus size={13} />
            <span>Create Your First Schedule</span>
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className="saas-card"
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                opacity: sch.enabled ? 1 : 0.65,
                transition: "all 0.15s",
              }}
            >
              {/* Schedule Card Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                      {sch.name}
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: sch.enabled ? "rgba(16,185,129,0.15)" : "var(--bg-surface-elevated)",
                        color: sch.enabled ? "#34d399" : "var(--text-muted)",
                        border: sch.enabled ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--border-medium)",
                      }}
                    >
                      {sch.enabled ? "Active" : "Disabled"}
                    </span>
                    {sch.onlyWhenOnline && (
                      <span style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--bg-surface-elevated)", padding: "2px 6px", borderRadius: 4 }}>
                        Online only
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ fontFamily: "monospace", color: "var(--text-pure)", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", padding: "2px 6px", borderRadius: 4 }}>
                      {sch.cron}
                    </span>
                    <span>·</span>
                    <span>
                      {sch.lastRunAt ? `Last run ${new Date(sch.lastRunAt).toLocaleTimeString()}` : "Never executed"}
                    </span>
                  </div>
                </div>

                {/* Card Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => triggerSchedule(sch)}
                    disabled={runningId === sch.id}
                    className="btn-solid-white"
                    style={{ padding: "5px 12px", fontSize: 12 }}
                    title="Execute Schedule Now"
                  >
                    {runningId === sch.id ? <Loader2 size={12} className="spin" /> : <Play size={12} />}
                    <span>{runningId === sch.id ? "Running..." : "Run Now"}</span>
                  </button>

                  <button
                    onClick={() => toggleScheduleEnabled(sch)}
                    className="btn-secondary-dark"
                    style={{ padding: "5px 10px", fontSize: 12 }}
                    title={sch.enabled ? "Disable Schedule" : "Enable Schedule"}
                  >
                    {sch.enabled ? <ToggleRight size={14} style={{ color: "var(--status-online)" }} /> : <ToggleLeft size={14} />}
                    <span>{sch.enabled ? "Enabled" : "Disabled"}</span>
                  </button>

                  <button
                    onClick={() => openEditModal(sch)}
                    className="btn-secondary-dark"
                    style={{ padding: "5px 8px" }}
                    title="Edit Schedule & Tasks"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    onClick={() => setDeleteTarget(sch)}
                    className="btn-secondary-dark"
                    style={{ padding: "5px 8px", color: "#f87171" }}
                    title="Delete Schedule"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Task Pipeline Visualizer */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", padding: "6px 0" }}>
                {sch.tasks.map((task, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12,
                      }}
                    >
                      {task.action === "COMMAND" ? (
                        <Terminal size={13} style={{ color: "#38bdf8" }} />
                      ) : task.action === "POWER" ? (
                        <Zap size={13} style={{ color: "#f59e0b" }} />
                      ) : (
                        <Archive size={13} style={{ color: "#34d399" }} />
                      )}
                      <div>
                        <span style={{ fontWeight: 600, color: "var(--text-pure)" }}>
                          {task.action === "COMMAND" ? "Command: " : task.action === "POWER" ? "Power: " : "Backup: "}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontFamily: task.action === "COMMAND" ? "monospace" : "inherit" }}>
                          {task.payload || "(auto)"}
                        </span>
                        {task.timeOffset > 0 && (
                          <span style={{ fontSize: 10.5, color: "var(--text-dim)", marginLeft: 6 }}>
                            (+{task.timeOffset}s delay)
                          </span>
                        )}
                      </div>
                    </div>

                    {idx < sch.tasks.length - 1 && (
                      <ArrowRight size={12} style={{ color: "var(--text-dim)" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create or Edit Schedule */}
      {modalOpen && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-box" style={{ maxWidth: 640, background: "var(--bg-surface)", border: "1px solid var(--border-medium)" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={15} style={{ color: "var(--text-pure)" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    {editingId ? "Edit Automation Schedule" : "Create New Schedule"}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Configure recurring cron triggers and action pipelines</p>
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
                {/* Schedule Name */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Midnight Auto Restart & Clean"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="saas-input"
                  />
                </div>

                {/* Cron Presets */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 8 }}>
                    Trigger Interval Presets
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 125px), 1fr))", gap: 6 }}>
                    {CRON_PRESETS.map((p) => {
                      const active = formCron === p.cron;
                      return (
                        <button
                          key={p.cron}
                          type="button"
                          onClick={() => setFormCron(p.cron)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "var(--radius-sm)",
                            border: active ? "1px solid #ffffff" : "1px solid var(--border-medium)",
                            background: active ? "#ffffff" : "var(--bg-surface-elevated)",
                            color: active ? "#000000" : "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            cursor: "pointer",
                            textAlign: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cron Expression Input */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Cron Expression (Minute Hour DOM Month DOW)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0 0 * * *"
                    value={formCron}
                    onChange={(e) => setFormCron(e.target.value)}
                    className="saas-input"
                    style={{ fontFamily: "monospace" }}
                  />
                </div>

                {/* Toggles */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 14px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                      style={{ accentColor: "#ffffff", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span>Schedule Enabled</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={formOnlyOnline}
                      onChange={(e) => setFormOnlyOnline(e.target.checked)}
                      style={{ accentColor: "#ffffff", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span>Only execute when server is online</span>
                  </label>
                </div>

                {/* Tasks Builder */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
                      Task Pipeline ({formTasks.length} sequential actions)
                    </span>
                    <button
                      type="button"
                      onClick={addTask}
                      className="btn-secondary-dark"
                      style={{ padding: "4px 8px", fontSize: 11.5 }}
                    >
                      <Plus size={12} /> Add Step
                    </button>
                  </div>

                  {formTasks.map((task, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-pure)" }}>
                          Step #{idx + 1}
                        </span>
                        {formTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTask(idx)}
                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 11.5, fontWeight: 500 }}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <select
                          value={task.action}
                          onChange={(e) => updateTask(idx, "action", e.target.value)}
                          className="saas-input"
                          style={{ flex: "1 1 120px", minWidth: 120, fontSize: 12.5 }}
                        >
                          <option value="COMMAND">Console Cmd</option>
                          <option value="POWER">Power Action</option>
                          <option value="BACKUP">Create Backup</option>
                        </select>

                        {task.action === "COMMAND" ? (
                          <input
                            type="text"
                            placeholder="e.g. say Broadcast message"
                            value={task.payload}
                            onChange={(e) => updateTask(idx, "payload", e.target.value)}
                            className="saas-input"
                            style={{ flex: "2 1 180px", minWidth: 180, fontSize: 12.5, fontFamily: "monospace" }}
                          />
                        ) : task.action === "POWER" ? (
                          <select
                            value={task.payload || "restart"}
                            onChange={(e) => updateTask(idx, "payload", e.target.value)}
                            className="saas-input"
                            style={{ flex: "2 1 180px", minWidth: 180, fontSize: 12.5 }}
                          >
                            <option value="restart">Restart Server</option>
                            <option value="stop">Stop Server</option>
                            <option value="start">Start Server</option>
                            <option value="kill">Force Kill</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            readOnly
                            value="Auto Backup Trigger"
                            className="saas-input"
                            style={{ flex: "2 1 180px", minWidth: 180, fontSize: 12.5, opacity: 0.6 }}
                          />
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 100px" }}>
                          <input
                            type="number"
                            min="0"
                            max="3600"
                            placeholder="Delay"
                            value={task.timeOffset}
                            onChange={(e) => updateTask(idx, "timeOffset", e.target.value)}
                            className="saas-input"
                            style={{ fontSize: 12.5, width: "100%" }}
                          />
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>sec</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
                  <span>{saving ? "Saving..." : editingId ? "Update Schedule" : "Create Schedule"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Schedule"
        description={`Are you sure you want to permanently delete schedule "${deleteTarget?.name}"?`}
        confirmLabel="Delete Schedule"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
