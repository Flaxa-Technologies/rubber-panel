"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Filter, RefreshCw, MoreHorizontal, Eye, Pencil, Trash2, ShieldOff, Shield, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Modal, ConfirmModal } from "@/components/ui/Modal";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { servers: number };
}

const roleColors: Record<string, "default" | "info" | "purple" | "muted" | "warning"> = {
  SUPER_ADMIN: "default",
  ADMIN: "info",
  STAFF: "purple",
  USER: "muted",
};

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "", role: "USER", status: "ACTIVE" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password, role: form.role, status: form.status }),
    });
    const data = await res.json();
    if (res.ok) { onCreated(); onClose(); setForm({ username: "", email: "", password: "", confirmPassword: "", role: "USER", status: "ACTIVE" }); }
    else { setError(data.error ?? "Failed to create user"); }
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Create User" description="Add a new user to the platform." size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={handleSubmit as any}>Create User</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "var(--color-rp-red)" }}>{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Username" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="johndoe" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="john@example.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="Min 8 chars" />
          <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required placeholder="Repeat password" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
            options={[{ value: "USER", label: "User" }, { value: "STAFF", label: "Staff" }, { value: "ADMIN", label: "Admin" }]} />
          <Select label="Status" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
            options={[{ value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }, { value: "PENDING", label: "Pending" }]} />
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleSuspendToggle() {
    if (!suspendTarget) return;
    setActionLoading(true);
    const newStatus = suspendTarget.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    await fetch(`/api/admin/users/${suspendTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSuspendTarget(null);
    setActionLoading(false);
    loadUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setActionLoading(false);
    loadUsers();
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>{total} total users</p>
        </div>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>Create User</Button>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--color-rp-text-muted)" }} />
            <input
              placeholder="Search users..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-9 pl-9 pr-3 rounded-lg border text-sm outline-none"
              style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border text-sm outline-none"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
            <option value="USER">User</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border text-sm outline-none"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING">Pending</option>
          </select>
          <Button variant="ghost" icon={RefreshCw} onClick={loadUsers} size="sm">Refresh</Button>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 skeleton rounded-lg" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-rp-border)" }}>
                  {["User", "Role", "Status", "Servers", "Last Login", "Joined", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors" style={{ borderColor: "var(--color-rp-border)" }}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-accent)" }}>
                          {user.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-rp-text)" }}>{user.username}</div>
                          <div className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge variant={roleColors[user.role] ?? "muted"}>{user.role}</Badge></td>
                    <td className="px-5 py-3"><StatusBadge status={user.status} /></td>
                    <td className="px-5 py-3 tabular-nums" style={{ color: "var(--color-rp-text-muted)" }}>{user._count.servers}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" icon={user.status === "SUSPENDED" ? Shield : ShieldOff}
                          onClick={() => setSuspendTarget(user)}>
                          {user.status === "SUSPENDED" ? "Unsuspend" : "Suspend"}
                        </Button>
                        <Button variant="ghost" size="sm" icon={Trash2}
                          onClick={() => setDeleteTarget(user)}
                          style={{ color: "var(--color-rp-red)" }}>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadUsers} />

      <ConfirmModal
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={handleSuspendToggle}
        loading={actionLoading}
        title={suspendTarget?.status === "SUSPENDED" ? "Unsuspend User" : "Suspend User"}
        description={`Are you sure you want to ${suspendTarget?.status === "SUSPENDED" ? "unsuspend" : "suspend"} ${suspendTarget?.username}?`}
        confirmLabel={suspendTarget?.status === "SUSPENDED" ? "Unsuspend" : "Suspend"}
        variant={suspendTarget?.status === "SUSPENDED" ? "warning" : "danger"}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={actionLoading}
        title="Delete User"
        description={`This will permanently delete ${deleteTarget?.username} and all their data. This action cannot be undone.`}
        confirmLabel="Delete User"
      />
    </div>
  );
}
