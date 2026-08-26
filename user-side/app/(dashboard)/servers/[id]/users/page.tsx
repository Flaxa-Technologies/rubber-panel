"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Users, UserPlus, Trash2, Check, X, AlertCircle,
  Loader2, CheckCircle2, Sliders
} from "lucide-react";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface Subuser {
  id: string;
  userId: string;
  roleName: string;
  permissions: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface PermissionGroup {
  name: string;
  description: string;
  permissions: {
    key: string;
    label: string;
    description: string;
  }[];
}

interface RolePreset {
  name: string;
  description: string;
  permissions: string[];
}

export default function ServerUsersPage() {
  const { id } = useParams<{ id: string }>();

  const [subusers, setSubusers] = useState<Subuser[]>([]);
  const [owner, setOwner] = useState<{ id: string; username: string; email: string } | null>(null);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [rolePresets, setRolePresets] = useState<RolePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("Server Manager");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  // Edit Modal
  const [editingSubuser, setEditingSubuser] = useState<Subuser | null>(null);
  const [editRole, setEditRole] = useState("Custom");
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<Subuser | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/user/servers/${id}/users`);
      if (res.ok) {
        const data = await res.json();
        setSubusers(data.subusers || []);
        setOwner(data.owner || null);
        setPermissionGroups(data.permissionGroups || []);
        setRolePresets(data.rolePresets || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load subusers.");
      }
    } catch {
      setError("Network error connecting to subusers API.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, [id]);

  function handleSelectPreset(roleName: string) {
    setSelectedRole(roleName);
    const preset = rolePresets.find(p => p.name === roleName);
    if (preset) {
      if (preset.permissions.includes("*")) {
        const allKeys = permissionGroups.flatMap(g => g.permissions.map(p => p.key));
        setSelectedPerms(allKeys);
      } else {
        setSelectedPerms(preset.permissions);
      }
    }
  }

  function handleSelectEditPreset(roleName: string) {
    setEditRole(roleName);
    const preset = rolePresets.find(p => p.name === roleName);
    if (preset) {
      if (preset.permissions.includes("*")) {
        const allKeys = permissionGroups.flatMap(g => g.permissions.map(p => p.key));
        setEditPerms(allKeys);
      } else {
        setEditPerms(preset.permissions);
      }
    }
  }

  function togglePerm(key: string, isEdit = false) {
    if (isEdit) {
      setEditRole("Custom");
      setEditPerms(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    } else {
      setSelectedRole("Custom");
      setSelectedPerms(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  }

  function toggleGroup(group: PermissionGroup, isEdit = false) {
    const groupKeys = group.permissions.map(p => p.key);
    if (isEdit) {
      setEditRole("Custom");
      const allSelected = groupKeys.every(k => editPerms.includes(k));
      if (allSelected) {
        setEditPerms(prev => prev.filter(k => !groupKeys.includes(k)));
      } else {
        setEditPerms(prev => Array.from(new Set([...prev, ...groupKeys])));
      }
    } else {
      setSelectedRole("Custom");
      const allSelected = groupKeys.every(k => selectedPerms.includes(k));
      if (allSelected) {
        setSelectedPerms(prev => prev.filter(k => !groupKeys.includes(k)));
      } else {
        setSelectedPerms(prev => Array.from(new Set([...prev, ...groupKeys])));
      }
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");

    try {
      const res = await fetch(`/api/user/servers/${id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          roleName: selectedRole,
          permissions: selectedRole === "Co-Owner / Admin" ? ["*"] : selectedPerms,
        }),
      });

      if (res.ok) {
        setShowInviteModal(false);
        setInviteEmail("");
        setSuccess("Collaborator invited successfully.");
        setTimeout(() => setSuccess(""), 3500);
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to invite subuser.");
      }
    } catch {
      setError("Network error while inviting subuser.");
    }
    setInviting(false);
  }

  function openEditModal(sub: Subuser) {
    setEditingSubuser(sub);
    setEditRole(sub.roleName || "Custom");
    try {
      const parsed: string[] = JSON.parse(sub.permissions);
      if (parsed.includes("*")) {
        setEditPerms(permissionGroups.flatMap(g => g.permissions.map(p => p.key)));
      } else {
        setEditPerms(parsed);
      }
    } catch {
      setEditPerms([]);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSubuser) return;
    setSavingEdit(true);
    setError("");

    try {
      const res = await fetch(`/api/user/servers/${id}/users/${editingSubuser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName: editRole,
          permissions: editRole === "Co-Owner / Admin" ? ["*"] : editPerms,
        }),
      });

      if (res.ok) {
        setEditingSubuser(null);
        setSuccess(`Updated permissions for ${editingSubuser.user.username}`);
        setTimeout(() => setSuccess(""), 3500);
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to save permissions.");
      }
    } catch {
      setError("Network error saving subuser.");
    }
    setSavingEdit(false);
  }

  async function confirmDeleteSubuser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/servers/${id}/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        setSuccess(`Removed collaborator access for ${deleteTarget.user.username}`);
        setTimeout(() => setSuccess(""), 3500);
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to remove subuser.");
      }
    } catch {
      setError("Network error removing collaborator.");
    }
    setDeleting(false);
  }

  function openInvite() {
    handleSelectPreset("Server Manager");
    setShowInviteModal(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Header Card */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} style={{ color: "var(--text-pure)" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-pure)" }}>
              Subusers &amp; Collaborators
            </h2>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
            Invite team members and assign granular permissions to control console, files, backups, and schedules.
          </p>
        </div>

        <button
          onClick={openInvite}
          className="btn-solid-white"
          style={{ padding: "7px 14px", fontSize: 12.5 }}
        >
          <UserPlus size={14} />
          <span>Invite Collaborator</span>
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

      {/* Users List */}
      <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
            Access List ({1 + subusers.length})
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Loader2 size={22} className="spin" style={{ margin: "0 auto", color: "var(--text-muted)" }} />
          </div>
        ) : (
          <div>
            {/* Owner Row */}
            {owner && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-medium)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  >
                    {owner.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-pure)" }}>
                        {owner.username}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: "var(--bg-surface-hover)",
                          color: "#ffffff",
                          border: "1px solid var(--border-medium)",
                        }}
                      >
                        Owner
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {owner.email}
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Full Instance Authority</span>
              </div>
            )}

            {/* Subusers Rows */}
            {subusers.length === 0 ? (
              <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No additional collaborators added yet. Click &quot;Invite Collaborator&quot; to share management access.
              </div>
            ) : (
              subusers.map((sub) => {
                let permCount = 0;
                try {
                  const p = JSON.parse(sub.permissions);
                  permCount = p.includes("*") ? 18 : p.length;
                } catch {
                  permCount = 0;
                }

                return (
                  <div
                    key={sub.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-medium)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          fontSize: 13,
                        }}
                      >
                        {sub.user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-pure)" }}>
                            {sub.user.username}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 9999,
                              background: "var(--bg-surface-elevated)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border-medium)",
                            }}
                          >
                            {sub.roleName}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                            ({permCount} perm{permCount !== 1 ? "s" : ""})
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {sub.user.email}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={() => openEditModal(sub)}
                        className="btn-secondary-dark"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        title="Edit Permissions"
                      >
                        <Sliders size={13} />
                        <span>Permissions</span>
                      </button>

                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="btn-secondary-dark"
                        style={{ padding: "5px 8px", color: "#f87171" }}
                        title="Remove Access"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-box" style={{ maxWidth: 620, background: "var(--bg-surface)", border: "1px solid var(--border-medium)" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserPlus size={15} style={{ color: "var(--text-pure)" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    Invite Collaborator
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Grant instance management access to another registered user</p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(90vh - 130px)" }}>
                {/* Email Input */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 6 }}>
                    User Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="collaborator@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="saas-input"
                  />
                  <span style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                    The user must already have a registered account on this panel.
                  </span>
                </div>

                {/* Role Presets */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 8 }}>
                    Role Preset
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 125px), 1fr))", gap: 6 }}>
                    {rolePresets.map((preset) => {
                      const active = selectedRole === preset.name;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleSelectPreset(preset.name)}
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
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grouped Permissions Checkboxes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
                      Granular Permissions ({selectedPerms.length} active)
                    </span>
                  </div>

                  {permissionGroups.map((group) => {
                    const groupKeys = group.permissions.map(p => p.key);
                    const allActive = groupKeys.every(k => selectedPerms.includes(k));

                    return (
                      <div
                        key={group.name}
                        style={{
                          padding: 12,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-pure)" }}>
                            {group.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group, false)}
                            style={{
                              background: "none",
                              border: "none",
                              color: allActive ? "var(--status-online)" : "var(--text-secondary)",
                              fontSize: 11.5,
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            {allActive ? "Deselect Group" : "Select All"}
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 6 }}>
                          {group.permissions.map((perm) => {
                            const active = selectedPerms.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 8,
                                  padding: "6px 8px",
                                  borderRadius: "var(--radius-sm)",
                                  background: active ? "var(--bg-surface-hover)" : "var(--bg-input)",
                                  border: active ? "1px solid var(--border-medium)" : "1px solid var(--border-subtle)",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  transition: "all 0.1s",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => togglePerm(perm.key, false)}
                                  style={{ accentColor: "#ffffff", marginTop: 2, cursor: "pointer" }}
                                />
                                <div>
                                  <span style={{ color: active ? "var(--text-pure)" : "var(--text-secondary)", fontWeight: 500 }}>
                                    {perm.label}
                                  </span>
                                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)", marginTop: 1 }}>
                                    {perm.description}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn-secondary-dark"
                  style={{ padding: "7px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="btn-solid-white"
                  style={{ padding: "7px 16px" }}
                >
                  {inviting ? <Loader2 size={13} className="spin" /> : <UserPlus size={13} />}
                  <span>{inviting ? "Inviting..." : "Send Invite"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingSubuser && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-box" style={{ maxWidth: 620, background: "var(--bg-surface)", border: "1px solid var(--border-medium)" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sliders size={15} style={{ color: "var(--text-pure)" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
                    Edit Permissions for {editingSubuser.user.username}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{editingSubuser.user.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSubuser(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(90vh - 130px)" }}>
                {/* Role Presets */}
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 8 }}>
                    Role Preset
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 125px), 1fr))", gap: 6 }}>
                    {rolePresets.map((preset) => {
                      const active = editRole === preset.name;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleSelectEditPreset(preset.name)}
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
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grouped Permissions Checkboxes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
                      Granular Permissions ({editPerms.length} active)
                    </span>
                  </div>

                  {permissionGroups.map((group) => {
                    const groupKeys = group.permissions.map(p => p.key);
                    const allActive = groupKeys.every(k => editPerms.includes(k));

                    return (
                      <div
                        key={group.name}
                        style={{
                          padding: 12,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-pure)" }}>
                            {group.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group, true)}
                            style={{
                              background: "none",
                              border: "none",
                              color: allActive ? "var(--status-online)" : "var(--text-secondary)",
                              fontSize: 11.5,
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            {allActive ? "Deselect Group" : "Select All"}
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 6 }}>
                          {group.permissions.map((perm) => {
                            const active = editPerms.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 8,
                                  padding: "6px 8px",
                                  borderRadius: "var(--radius-sm)",
                                  background: active ? "var(--bg-surface-hover)" : "var(--bg-input)",
                                  border: active ? "1px solid var(--border-medium)" : "1px solid var(--border-subtle)",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  transition: "all 0.1s",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => togglePerm(perm.key, true)}
                                  style={{ accentColor: "#ffffff", marginTop: 2, cursor: "pointer" }}
                                />
                                <div>
                                  <span style={{ color: active ? "var(--text-pure)" : "var(--text-secondary)", fontWeight: 500 }}>
                                    {perm.label}
                                  </span>
                                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-dim)", marginTop: 1 }}>
                                    {perm.description}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingSubuser(null)}
                  className="btn-secondary-dark"
                  style={{ padding: "7px 14px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-solid-white"
                  style={{ padding: "7px 16px" }}
                >
                  {savingEdit ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={!!deleteTarget}
        title="Remove Collaborator"
        description={`Are you sure you want to revoke server access for "${deleteTarget?.user.username}" (${deleteTarget?.user.email})?`}
        confirmLabel="Remove Access"
        destructive
        loading={deleting}
        onConfirm={confirmDeleteSubuser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
