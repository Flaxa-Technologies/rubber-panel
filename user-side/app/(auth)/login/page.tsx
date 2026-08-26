"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/servers";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        setError("Invalid username/email or password.");
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
          Log In
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8" }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            style={{
              color: "#818cf8",
              fontWeight: 600,
              textDecoration: "none",
            }}
            className="hover:underline"
          >
            Register
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

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Email or Username Input */}
        <div>
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="Email or username"
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

        {/* Password Input with Visibility Toggle */}
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

        {/* Primary Action Button */}
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
          {loading ? <Loader2 size={16} className="spin" /> : "Log In"}
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
