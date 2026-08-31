"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Dashboard error:", error);
  }, [error]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24, textAlign: "center" }}>
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

      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
        Admin Section Encountered an Error
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 460, lineHeight: 1.5 }}>
        {error?.message || "An unexpected error occurred while loading this administrative view."}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Try Again
        </button>
        <Link
          href="/"
          className="btn btn-ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Admin Overview
        </Link>
      </div>
    </div>
  );
}
