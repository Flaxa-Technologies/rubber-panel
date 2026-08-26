import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "muted";
  size?: "sm" | "md";
  dot?: boolean;
}

const variantStyles: Record<string, { bg: string; color: string; border: string }> = {
  default: { bg: "rgba(163,230,53,0.1)", color: "var(--color-rp-accent)", border: "rgba(163,230,53,0.2)" },
  primary: { bg: "rgba(163,230,53,0.1)", color: "var(--color-rp-accent)", border: "rgba(163,230,53,0.2)" },
  success: { bg: "rgba(34,197,94,0.1)", color: "var(--color-rp-green)", border: "rgba(34,197,94,0.2)" },
  warning: { bg: "rgba(234,179,8,0.1)", color: "var(--color-rp-yellow)", border: "rgba(234,179,8,0.2)" },
  danger: { bg: "rgba(239,68,68,0.1)", color: "var(--color-rp-red)", border: "rgba(239,68,68,0.2)" },
  info: { bg: "rgba(59,130,246,0.1)", color: "var(--color-rp-blue)", border: "rgba(59,130,246,0.2)" },
  purple: { bg: "rgba(168,85,247,0.1)", color: "var(--color-rp-purple)", border: "rgba(168,85,247,0.2)" },
  muted: { bg: "var(--color-rp-surface-2)", color: "var(--color-rp-text-muted)", border: "var(--color-rp-border)" },
};

export function Badge({ children, variant = "default", size = "sm", dot }: BadgeProps) {
  const styles = variantStyles[variant] || variantStyles.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}`}
      style={{ backgroundColor: styles.bg, color: styles.color, borderColor: styles.border }}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: styles.color }} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    RUNNING: { label: "Running", variant: "success" },
    STOPPED: { label: "Stopped", variant: "muted" },
    STARTING: { label: "Starting", variant: "info" },
    STOPPING: { label: "Stopping", variant: "warning" },
    INSTALLING: { label: "Installing", variant: "purple" },
    CRASHED: { label: "Crashed", variant: "danger" },
    OFFLINE: { label: "Offline", variant: "muted" },
    ONLINE: { label: "Online", variant: "success" },
    DEGRADED: { label: "Degraded", variant: "warning" },
    MAINTENANCE: { label: "Maintenance", variant: "warning" },
    ACTIVE: { label: "Active", variant: "success" },
    SUSPENDED: { label: "Suspended", variant: "danger" },
    PENDING: { label: "Pending", variant: "warning" },
    COMPLETED: { label: "Completed", variant: "success" },
    FAILED: { label: "Failed", variant: "danger" },
    IN_PROGRESS: { label: "In Progress", variant: "info" },
  };

  const config = map[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={config.variant} dot>{config.label}</Badge>;
}
