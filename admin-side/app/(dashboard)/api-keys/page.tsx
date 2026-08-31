"use client";

import { useState } from "react";
import { Key, Copy, Check, Eye, EyeOff, Shield, Info, AlertTriangle, Users, MonitorSpeaker } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

// In a full implementation this would be database-backed.
// For now show the internal secrets used by user-side/node-side.
export default function ApiKeysPage() {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, label: string) {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const mask = (s: string) => s.replace(/./g, "•");

  const internalSecret = "rubber-panel-internal-secret";

  const INTEGRATIONS = [
    {
      title: "User-Side Panel",
      key: "INTERNAL_API_SECRET",
      description: "Used by user-side (port 3002) to authenticate calls to the admin API. Must match in user-side .env.",
      value: internalSecret,
      icon: Users,
      env: "user-side/.env → INTERNAL_API_SECRET",
      type: "Internal",
    },
    {
      title: "Node Agent",
      key: "NODE_WEBHOOK_SECRET",
      description: "Used by node-side agents to authenticate heartbeats and server commands. Must match in node-side .env.",
      value: internalSecret,
      icon: MonitorSpeaker,
      env: "node-side/.env → NODE_WEBHOOK_SECRET",
      type: "Internal",
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>API Keys</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
          Internal secrets and integration credentials for Rubber Panel.
        </p>
      </div>

      {/* Warning */}
      <div className="rounded-xl border p-4 flex items-start gap-3"
        style={{ backgroundColor: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }}>
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--color-rp-red)" }} />
        <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>
          <strong style={{ color: "var(--color-rp-text)" }}>Never share these secrets.</strong>{" "}
          If a secret is compromised, rotate it immediately in all affected .env files and restart the services.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>Internal Secrets</h2>
        <button onClick={() => setRevealed(r => !r)}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border"
          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {revealed ? "Hide" : "Reveal"} secrets
        </button>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map(item => (
          <div key={item.key} className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--color-rp-surface-2)" }}>
                  <item.icon className="w-4 h-4 text-lime-400" style={{ color: "var(--color-rp-accent)" }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--color-rp-text)" }}>{item.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(163,230,53,0.1)", color: "var(--color-rp-accent)" }}>
                      {item.type}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-rp-text-muted)" }}>{item.description}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3 flex items-center gap-3"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)" }}>
                <code className="flex-1 text-xs font-mono break-all" style={{ color: "var(--color-rp-text)" }}>
                  {revealed ? item.value : mask(item.value)}
                </code>
                <button onClick={() => copy(item.value, item.key)}
                  className="flex-shrink-0 p-1.5 rounded-md" style={{ color: "var(--color-rp-text-muted)" }}>
                  {copied === item.key ? <Check className="w-3.5 h-3.5" style={{ color: "var(--color-rp-green)" }} /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="px-5 py-3 border-t flex items-center gap-2"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
              <Key className="w-3 h-3" style={{ color: "var(--color-rp-text-dim)" }} />
              <code className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>{item.env}</code>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border-2)" }}>
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--color-rp-accent)" }} />
          <div>
            <p className="font-medium text-sm mb-1" style={{ color: "var(--color-rp-text)" }}>External API Access</p>
            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
              Full external API key management (per-user tokens, scopes, rotation) is planned for a future update. 
              Current integration relies on internal shared secrets for service-to-service communication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
