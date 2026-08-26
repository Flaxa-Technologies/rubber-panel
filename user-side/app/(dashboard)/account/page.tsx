"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Key, LogOut, Check, AlertCircle, Loader2 } from "lucide-react";

export default function AccountPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const displayName = user?.username ?? user?.name ?? "User";

  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPwError("New passwords do not match.");
      return;
    }
    if (passwordForm.newPass.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    setPwLoading(true);
    setPwError("");
    await new Promise((r) => setTimeout(r, 600));
    setPwLoading(false);
    setPwSuccess(true);
    setPasswordForm({ current: "", newPass: "", confirm: "" });
    setTimeout(() => setPwSuccess(false), 2500);
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
          Account
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          Manage your profile and authentication settings.
        </p>
      </div>

      {/* User info */}
      <div className="saas-card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#27272a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
            {displayName[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-pure)" }}>{displayName}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border-subtle)", paddingTop: 14, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Username</span>
            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{displayName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Email</span>
            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{user?.email ?? "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Role</span>
            <span style={{ fontWeight: 600, color: "#ffffff" }}>{user?.role ?? "USER"}</span>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="saas-card" style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-pure)", marginBottom: 14 }}>
          Change Password
        </div>

        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pwSuccess && (
            <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, color: "#10b981", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} /> Password updated!
            </div>
          )}
          {pwError && (
            <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#f87171", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={14} /> {pwError}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Current Password
            </label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
              required
              placeholder="••••••••"
              className="saas-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
                New Password
              </label>
              <input
                type="password"
                value={passwordForm.newPass}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPass: e.target.value }))}
                required
                placeholder="••••••••"
                className="saas-input"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
                Confirm
              </label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                required
                placeholder="••••••••"
                className="saas-input"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={pwLoading} 
            className="btn-solid-white"
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          >
            {pwLoading ? <Loader2 size={13} className="spin" /> : "Save"}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div className="saas-card" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Session</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sign out of your account on this device.</div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary-dark">
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
