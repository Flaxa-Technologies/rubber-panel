import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({ children, className = "", padding = "md", hover = false }: CardProps) {
  const paddingMap = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };
  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${paddingMap[padding]} ${hover ? "cursor-pointer" : ""} ${className}`}
      style={{
        backgroundColor: "var(--color-rp-surface)",
        borderColor: "var(--color-rp-border)",
        ...(hover ? {} : {}),
      }}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  accentColor?: string;
  sublabel?: string;
}

export function StatCard({ label, value, icon: Icon, trend, accentColor = "var(--color-rp-accent)", sublabel }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--color-rp-text-muted)" }}>
            {label}
          </p>
          <p className="text-3xl font-bold mt-1" style={{ color: "var(--color-rp-text)" }}>
            {value}
          </p>
          {sublabel && (
            <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
              {sublabel}
            </p>
          )}
          {trend && (
            <p
              className="text-xs mt-2 font-medium"
              style={{ color: trend.value >= 0 ? "var(--color-rp-green)" : "var(--color-rp-red)" }}
            >
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>
    </Card>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-between pb-4 mb-4 border-b ${className}`}
      style={{ borderColor: "var(--color-rp-border)" }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
      {children}
    </h2>
  );
}
