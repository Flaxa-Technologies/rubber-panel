import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ElementType;
}

export function Input({ label, error, hint, icon: Icon, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium"
          style={{ color: "var(--color-rp-text)" }}
        >
          {label}
          {props.required && <span className="ml-1" style={{ color: "var(--color-rp-accent)" }}>*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
          </div>
        )}
        <input
          id={inputId}
          className={`w-full h-9 rounded-lg border text-sm outline-none transition-all duration-150 ${Icon ? "pl-9 pr-3" : "px-3"} ${className}`}
          style={{
            backgroundColor: "var(--color-rp-surface-2)",
            borderColor: error ? "var(--color-rp-red)" : "var(--color-rp-border-2)",
            color: "var(--color-rp-text)",
          }}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-rp-red)" }}>{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>{hint}</p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>
          {label}
        </label>
      )}
      <select
        id={inputId}
        className="w-full h-9 px-3 rounded-lg border text-sm outline-none transition-all duration-150"
        style={{
          backgroundColor: "var(--color-rp-surface-2)",
          borderColor: error ? "var(--color-rp-red)" : "var(--color-rp-border-2)",
          color: "var(--color-rp-text)",
        }}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: "var(--color-rp-surface-2)" }}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs" style={{ color: "var(--color-rp-red)" }}>{error}</p>}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5"
        style={{ backgroundColor: checked ? "var(--color-rp-accent)" : "var(--color-rp-border-2)" }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
      {(label || description) && (
        <div>
          {label && <p className="text-sm font-medium" style={{ color: "var(--color-rp-text)" }}>{label}</p>}
          {description && <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>{description}</p>}
        </div>
      )}
    </div>
  );
}
