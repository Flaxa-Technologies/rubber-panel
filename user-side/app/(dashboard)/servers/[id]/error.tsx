"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function ServerErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Server layout/page error:", error);
    if (
      error.message?.includes("ChunkLoadError") ||
      error.message?.includes("Failed to load chunk") ||
      error.message?.includes("loading chunk")
    ) {
      // Automatically reload page to fetch fresh chunks from updated deployment
      window.location.reload();
    }
  }, [error]);

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 20px" }}>
      <div className="saas-card" style={{ padding: 32, textAlign: "center", borderColor: "rgba(239, 68, 68, 0.3)" }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          color: "#f87171"
        }}>
          <AlertTriangle size={24} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f87171", marginBottom: 8 }}>
          Something went wrong loading this view
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, maxWidth: 480, margin: "0 auto 20px" }}>
          {error.message || "An unexpected error occurred while rendering the server interface."}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => {
              if (
                error.message?.includes("ChunkLoadError") ||
                error.message?.includes("Failed to load chunk") ||
                error.message?.includes("chunk")
              ) {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="btn-solid-white"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} /> Reload Interface
          </button>
          <Link href="/dashboard" className="btn-secondary-dark" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Back to servers
          </Link>
        </div>
      </div>
    </div>
  );
}
