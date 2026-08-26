"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { getPublicConfig } from "@/lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/servers";
  const justRegistered = searchParams.get("registered") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [regEnabled, setRegEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getPublicConfig().then((cfg) => {
      setRegEnabled(cfg.registrationEnabled);
    }).catch(() => {
      setRegEnabled(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });

      if (res?.error) {
        setError("Invalid email or password.");
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError("An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, width: "100%" }}>
      {/* Title & Subtitle */}
      <div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            marginBottom: 6,
          }}
        >
          Welcome Back
        </h1>
        {regEnabled === true ? (
          <p style={{ fontSize: 14, color: "#94a3b8" }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              style={{
                color: "#a3e635",
                fontWeight: 600,
                textDecoration: "none",
              }}
              className="hover:underline"
            >
              Create one here
            </Link>
          </p>
        ) : regEnabled === false ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>
            New user registration is currently closed
          </p>
        ) : (
          <p style={{ fontSize: 14, color: "#94a3b8" }}>
            Sign in to access your game servers
          </p>
        )}
      </div>

      {/* Success Notification (After Registration) */}
      {justRegistered && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(163, 230, 53, 0.1)",
            border: "1px solid rgba(163, 230, 53, 0.3)",
            borderRadius: 10,
            color: "#a3e635",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>Account created successfully! You can now log in below.</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: 10,
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Email or Username Input */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#94a3b8", marginBottom: 6 }}>
            Email Address or Username
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="Enter your email or username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 10,
              background: "#141722",
              border: "1px solid #23273a",
              color: "#ffffff",
              fontSize: 14,
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#a3e635";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(163, 230, 53, 0.18)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#23273a";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Password Input with Visibility Toggle */}
        <div style={{ position: "relative" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#94a3b8", marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 44px 14px 16px",
                borderRadius: 10,
                background: "#141722",
                border: "1px solid #23273a",
                color: "#ffffff",
                fontSize: 14,
                outline: "none",
                transition: "all 0.15s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#a3e635";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(163, 230, 53, 0.18)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#23273a";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "14px 20px",
            borderRadius: 10,
            background: "#a3e635",
            color: "#0f172a",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(163, 230, 53, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "#bef264";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "#a3e635";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Log In to Panel"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-lime-400" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
