"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, AlertCircle, Loader2, Check } from "lucide-react";

export default function RegisterForm() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true); setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    });
    const data = await res.json();

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } else {
      setError(data.error ?? "Registration failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--color-rp-bg)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(163,230,53,0.04) 0%, transparent 60%)" }} />

      <div className="w-full max-w-sm animate-slide-in">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-lg mb-4 text-lg font-bold"
            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
          >
            RP
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>Create Account</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>Rubber Panel · Flaxa Studios</p>
        </div>

        <div className="rounded-lg border p-6 space-y-5" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                <Check className="w-6 h-6" style={{ color: "var(--color-rp-green)" }} />
              </div>
              <p className="font-semibold" style={{ color: "var(--color-rp-text)" }}>Account created!</p>
              <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>Redirecting to login...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-3 p-3 rounded-lg border text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "var(--color-rp-red)" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { label: "Username", key: "username", type: "text", icon: User, placeholder: "johndoe" },
                  { label: "Email", key: "email", type: "email", icon: Mail, placeholder: "you@example.com" },
                  { label: "Password", key: "password", type: "password", icon: Lock, placeholder: "Min 8 characters" },
                  { label: "Confirm Password", key: "confirmPassword", type: "password", icon: Lock, placeholder: "Repeat password" },
                ].map(({ label, key, type, icon: Icon, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--color-rp-text-muted)" }} />
                      <input id={key} type={type} value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        required placeholder={placeholder}
                        className="w-full h-10 pl-10 pr-3 rounded-lg border text-sm outline-none"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }} />
                    </div>
                  </div>
                ))}

                <button id="register-submit" type="submit" disabled={loading}
                  className="w-full h-10 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : "Create Account"}
                </button>
              </form>

              <p className="text-center text-sm" style={{ color: "var(--color-rp-text-muted)" }}>
                Already have an account?{" "}
                <Link href="/login" className="font-medium" style={{ color: "var(--color-rp-accent)" }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
