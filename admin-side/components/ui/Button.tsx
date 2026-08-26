import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ElementType;
  iconRight?: React.ElementType;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const sizeMap = {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-9 px-4 text-sm gap-2",
    lg: "h-11 px-5 text-sm gap-2",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--color-rp-accent)",
      color: "#000",
      border: "1px solid var(--color-rp-accent)",
    },
    secondary: {
      backgroundColor: "var(--color-rp-surface-2)",
      color: "var(--color-rp-text)",
      border: "1px solid var(--color-rp-border-2)",
    },
    danger: {
      backgroundColor: "rgba(239,68,68,0.1)",
      color: "var(--color-rp-red)",
      border: "1px solid rgba(239,68,68,0.3)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--color-rp-text-muted)",
      border: "1px solid transparent",
    },
    outline: {
      backgroundColor: "transparent",
      color: "var(--color-rp-text)",
      border: "1px solid var(--color-rp-border-2)",
    },
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeMap[size]} ${className}`}
      style={variantStyles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        Icon && <Icon className="w-3.5 h-3.5" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="w-3.5 h-3.5" />}
    </button>
  );
}
