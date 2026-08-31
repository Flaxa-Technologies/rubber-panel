"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Root error:", error);
  }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center", background: "#09090b", color: "#fafafa" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#f87171",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <AlertTriangle size={28} />
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
        Admin Portal Error
      </h2>
      <p style={{ fontSize: 13.5, color: "#a1a1aa", marginTop: 8, maxWidth: 460, lineHeight: 1.5 }}>
        {error?.message || "An unexpected error occurred in the admin portal."}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#38bdf8",
            color: "#000000",
            fontWeight: 600,
            fontSize: 13,
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={14} /> Try Again
        </button>
        <Link
          href="/"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.08)",
            color: "#ffffff",
            fontWeight: 500,
            fontSize: 13,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> Return Home
        </Link>
      </div>
    </div>
  );
}
