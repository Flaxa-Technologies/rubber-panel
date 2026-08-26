"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Info } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState({
    siteName: "Rubber Panel",
    siteDescription: "Admin Control Panel · Flaxa Studios",
    logoUrl: "/logo.png",
  });
  const router = useRouter();

  useEffect(() => {
    fetch("/api/customization")
      .then(r => r.json())
      .then(d => {
        if (d.customization) {
          setBranding({
            siteName: d.customization["branding.siteName"] || "Rubber Panel",
            siteDescription: d.customization["branding.siteDescription"] || "Admin Control Panel · Flaxa Studios",
            logoUrl: d.customization["branding.logoUrl"] || "/logo.png",
          });
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Invalid credentials or insufficient permissions.");
      setLoading(false);
    }
  }

  function fillDefaults() {
    setEmail("admin@rubberlab.net");
    setPassword("ChangeMe123!");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-rp-bg)" }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(163,230,53,0.07) 0%, transparent 65%)",
        }}
      />

      <div className="w-full max-w-sm animate-slide-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden p-2"
            style={{ backgroundColor: "#111", border: "1px solid var(--color-rp-border)" }}>
            <Image src={branding.logoUrl || "/logo.png"} alt={branding.siteName} width={48} height={48} className="object-contain" unoptimized />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>
            {branding.siteName}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            {branding.siteDescription}
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl border p-6 space-y-5"
          style={{
            backgroundColor: "var(--color-rp-surface)",
            borderColor: "var(--color-rp-border)",
          }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--color-rp-text)" }}>
              Administrator Login
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
              Access restricted to admins and staff only.
            </p>
          </div>

          {/* Default credentials hint */}
          <div
            className="rounded-xl border p-3 text-xs space-y-1.5 cursor-pointer select-none"
            onClick={fillDefaults}
            title="Click to auto-fill"
            style={{
              backgroundColor: "rgba(163,230,53,0.05)",
              borderColor: "rgba(163,230,53,0.2)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--color-rp-accent)" }}>
              <Info className="w-3.5 h-3.5" />
              <span className="font-semibold">Default Credentials</span>
              <span className="ml-auto text-xs opacity-60" style={{ color: "var(--color-rp-text-muted)" }}>click to fill</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: "var(--color-rp-text-muted)" }}>
              <span>Email</span>
              <code style={{ color: "var(--color-rp-text)", fontFamily: "monospace" }}>admin@rubberlab.net</code>
            </div>
            <div className="flex items-center justify-between" style={{ color: "var(--color-rp-text-muted)" }}>
              <span>Password</span>
              <code style={{ color: "var(--color-rp-text)", fontFamily: "monospace" }}>ChangeMe123!</code>
            </div>
          </div>

          {error && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg border text-sm"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.25)",
                color: "var(--color-rp-red)",
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--color-rp-text-muted)" }}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@rubberlab.net"
                  required
                  autoComplete="email"
                  className="w-full h-10 pl-10 pr-3 rounded-lg border text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border-2)",
                    color: "var(--color-rp-text)",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--color-rp-text-muted)" }}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full h-10 pl-10 pr-10 rounded-lg border text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-rp-surface-2)",
                    borderColor: "var(--color-rp-border-2)",
                    color: "var(--color-rp-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-rp-text-muted)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-60"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                "Sign in to Admin Panel"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-rp-text-dim)" }}>
          Rubber Panel v1.0.0 · Flaxa Studios · Admin access only
        </p>
      </div>
    </div>
  );
}
