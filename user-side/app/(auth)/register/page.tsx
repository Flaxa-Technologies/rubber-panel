"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
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
  const [regEnabled, setRegEnabled] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getPublicConfig().then((c) => {
      setRegEnabled(c.registrationEnabled);
      setChecking(false);
      if (!c.registrationEnabled) {
        router.push("/login");
      }
    });
  }, [router]);

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
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed.");
      } else {
        router.push("/login?registered=true");
      }
    } catch {
      setError("An unexpected registration error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (checking || !regEnabled) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%" }}>
      {/* Title & Subtitle */}
      <div>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            marginBottom: 8,
          }}
        >
          Create an account
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "#818cf8",
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
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Username */}
        <div>
          <input
            type="text"
            required
            pattern="^[a-zA-Z0-9_]{3,20}$"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "15px 18px",
              borderRadius: 10,
              background: "#141722",
              border: "1px solid #23273a",
              color: "#ffffff",
              fontSize: 14,
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.18)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#23273a";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Email */}
        <div>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "15px 18px",
              borderRadius: 10,
              background: "#141722",
              border: "1px solid #23273a",
              color: "#ffffff",
              fontSize: 14,
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.18)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#23273a";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Password with Toggle */}
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "15px 48px 15px 18px",
              borderRadius: 10,
              background: "#141722",
              border: "1px solid #23273a",
              color: "#ffffff",
              fontSize: 14,
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.18)";
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
              right: 16,
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
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Agree Terms Checkbox */}
        <div style={{ marginTop: 2 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{
                accentColor: "#6366f1",
                width: 17,
                height: 17,
                cursor: "pointer",
                borderRadius: 4,
              }}
            />
            <span>
              I agree to the{" "}
              <span style={{ color: "#818cf8", fontWeight: 500 }}>Terms &amp; Conditions</span>
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
            padding: "15px 20px",
            borderRadius: 10,
            background: "#5b45e0",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 15,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(91, 69, 224, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "#6751ee";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "#5b45e0";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : "Create Account"}
        </button>
      </form>
    </div>
  );
}
