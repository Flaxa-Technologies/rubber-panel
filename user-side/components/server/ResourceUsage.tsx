interface ResourceUsageProps {
  label: string;
  value: string;
  limit?: string;
  percent?: number;
  sublabel?: string;
}

export default function ResourceUsage({ label, value, limit, percent, sublabel }: ResourceUsageProps) {
  const barPercent = percent !== undefined ? Math.min(Math.max(percent, 0), 100) : undefined;

  return (
    <div className="resource-card">
      <h3 className="resource-title">{label}</h3>
      <div className="resource-value">
        {value} {limit && <span className="text-sm font-normal text-secondary">/ {limit}</span>}
      </div>
      
      {barPercent !== undefined && (
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${barPercent}%`,
              backgroundColor: barPercent > 85 ? "var(--color-danger)" : "var(--color-info)",
            }}
          />
        </div>
      )}
      
      {sublabel && <p className="text-xs text-muted mt-2">{sublabel}</p>}
    </div>
  );
}
