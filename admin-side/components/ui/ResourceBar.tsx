interface ResourceBarProps {
  label: string;
  used: number;
  total?: number;
  unit?: string;
  color?: string;
}

export function ResourceBar({ label, used, total, unit = "%", color = "var(--color-rp-accent)" }: ResourceBarProps) {
  const pct = total ? Math.min((used / total) * 100, 100) : Math.min(used, 100);
  const barColor = pct > 85 ? "var(--color-rp-red)" : pct > 65 ? "var(--color-rp-yellow)" : color;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: "var(--color-rp-text)" }}>
          {total ? `${used.toFixed(0)}${unit} / ${total}${unit}` : `${used.toFixed(1)}${unit}`}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-rp-border-2)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

interface GaugeProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: "sm" | "md";
}

export function Gauge({ value, max = 100, label, unit = "%", size = "md" }: GaugeProps) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 85 ? "var(--color-rp-red)" : pct > 65 ? "var(--color-rp-yellow)" : "var(--color-rp-accent)";

  const r = size === "sm" ? 28 : 40;
  const stroke = size === "sm" ? 4 : 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const svgSize = (r + stroke) * 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none"
            strokeWidth={stroke} stroke="var(--color-rp-border-2)" />
          <circle cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none"
            strokeWidth={stroke} stroke={color}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold font-mono ${size === "sm" ? "text-xs" : "text-sm"}`} style={{ color: "var(--color-rp-text)" }}>
            {value.toFixed(0)}{unit}
          </span>
        </div>
      </div>
      <span className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>{label}</span>
    </div>
  );
}
