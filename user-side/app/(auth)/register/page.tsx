"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import { getPublicConfig } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [regEnabled, setRegEnabled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getPublicConfig().then((cfg) => {
      setRegEnabled(cfg.registrationEnabled);
      setChecking(false);
    }).catch(() => {
      setRegEnabled(false);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setError("Please agree to the Terms & Conditions to proceed.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please check your information.");
      } else {
        router.push("/login?registered=true");
      }
    } catch {
      setError("An unexpected registration error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 12 }}>
        <Loader2 size={24} className="animate-spin text-lime-400" />
        <span style={{ fontSize: 13, color: "#94a3b8" }}>Checking system configuration...</span>
      </div>
    );
  }

  // Registration Disabled View
  if (regEnabled === false) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f87171",
            }}
          >
            <ShieldAlert size={28} />
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
            Registration Closed
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6 }}>
            New user registration is currently disabled by the server administrator.
            Only existing accounts can log in.
          </p>
        </div>

        <Link
          href="/login"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "14px 20px",
            borderRadius: 10,
            background: "#141722",
            border: "1px solid #23273a",
            color: "#a3e635",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
        >
          <ArrowLeft size={16} />
          <span>Return to Log In</span>
        </Link>
      </div>
    );
  }

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
          Create Account
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "#a3e635",
              fontWeight: 600,
              textDecoration: "none",
            }}
            className="hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>

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

      {/* Registration Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Username */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#94a3b8", marginBottom: 6 }}>
            Username
          </label>
          <input
            type="text"
            required
            pattern="^[a-zA-Z0-9_]{3,32}$"
            title="Username must be 3-32 alphanumeric characters"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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

        {/* Email */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#94a3b8", marginBottom: 6 }}>
            Email Address
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
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

        {/* Password with Toggle */}
        <div style={{ position: "relative" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#94a3b8", marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
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

        {/* Agree Terms Checkbox */}
        <div style={{ marginTop: 2 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{
                accentColor: "#a3e635",
                width: 17,
                height: 17,
                cursor: "pointer",
                borderRadius: 4,
              }}
            />
            <span>
              I agree to the{" "}
              <span style={{ color: "#a3e635", fontWeight: 500 }}>Terms &amp; Conditions</span>
            </span>
          </label>
        </div>

        {/* Action Button */}
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
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
        </button>
      </form>
    </div>
  );
}
