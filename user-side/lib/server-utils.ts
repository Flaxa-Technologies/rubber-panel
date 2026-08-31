import type { UserServer } from "./types";

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; pulse?: boolean }
> = {
  RUNNING: { label: "Running", color: "var(--color-rp-green)", pulse: true },
  STOPPED: { label: "Stopped", color: "var(--color-rp-text-muted)" },
  STARTING: { label: "Starting", color: "var(--color-rp-blue)" },
  STOPPING: { label: "Stopping", color: "var(--color-rp-yellow)" },
  CRASHED: { label: "Error", color: "var(--color-rp-red)" },
  OFFLINE: { label: "Offline", color: "var(--color-rp-text-dim)" },
  INSTALLING: { label: "Installing", color: "var(--color-rp-blue)" },
  SUSPENDED: { label: "Suspended", color: "var(--color-rp-red)" },
};

export function getStatusConfig(status: string, suspended?: boolean) {
  if (suspended) return STATUS_CONFIG.SUSPENDED;
  return STATUS_CONFIG[status] ?? { label: status, color: "var(--color-rp-text-muted)" };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRam(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
}

export function formatDisk(mb: number): string {
  return `${Math.round(mb / 1024)} GB`;
}

export function getPrimaryAllocation(server: UserServer) {
  return server.allocations?.[0] ?? null;
}

export function getServerAddress(server: UserServer): string {
  const allocation = server.allocations?.[0];
  const port = allocation?.port ?? server.port ?? 25565;
  const currentHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

  if (allocation?.ip && allocation.ip !== "0.0.0.0" && allocation.ip !== "127.0.0.1" && allocation.ip !== "localhost") {
    return `${allocation.ip}:${port}`;
  }

  if (server.node?.fqdn && server.node.fqdn !== "127.0.0.1" && server.node.fqdn !== "localhost" && server.node.fqdn !== "0.0.0.0") {
    return `${server.node.fqdn}:${port}`;
  }

  if (allocation?.ip && allocation.ip !== "0.0.0.0") {
    return `${allocation.ip}:${port}`;
  }

  return `${currentHost}:${port}`;
}

export function formatAllocation(allocation: { ip: string; port: number } | null) {
  if (!allocation) return "—";
  return `${allocation.ip}:${allocation.port}`;
}

export function countServersByStatus(servers: UserServer[]) {
  return {
    total: servers.length,
    running: servers.filter((s) => s.status === "RUNNING").length,
    offline: servers.filter(
      (s) => !s.suspended && s.status !== "RUNNING" && s.status !== "STARTING" && s.status !== "STOPPING" && s.status !== "WAKING"
    ).length,
    suspended: servers.filter((s) => s.suspended).length,
    other: servers.filter(
      (s) => !s.suspended && (s.status === "STARTING" || s.status === "STOPPING" || s.status === "WAKING")
    ).length,
  };
}
