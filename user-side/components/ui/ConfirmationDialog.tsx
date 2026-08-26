"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div 
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }} 
        onClick={onCancel} 
      />
      <div
        className="card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          padding: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          zIndex: 10,
        }}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onCancel}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingRight: 20 }}>
          <div
            style={{
              padding: 8,
              borderRadius: 8,
              background: destructive ? "var(--red-bg)" : "var(--blue-bg)",
              color: destructive ? "var(--red)" : "var(--blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{title}</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{description}</p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={destructive ? "btn btn-danger" : "btn btn-primary"}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
