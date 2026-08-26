import { getStatusConfig } from "@/lib/server-utils";

interface ServerStatusProps {
  status: string;
  suspended?: boolean;
}

export default function ServerStatus({
  status,
  suspended,
}: ServerStatusProps) {
  const config = getStatusConfig(status, suspended);
  const statusClass = status.toLowerCase() === "running" ? "online" : status.toLowerCase();

  return (
    <div className={`status-badge ${statusClass}`}>
      <span className={`status-dot ${statusClass}`} />
      <span>{config.label}</span>
    </div>
  );
}
