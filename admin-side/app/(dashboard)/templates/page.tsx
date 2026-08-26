"use client";

import { FileCode2, Copy, Check, Info } from "lucide-react";
import { useState } from "react";

const TEMPLATES = [
  {
    name: "Survival SMP",
    description: "Standard Survival Multiplayer setup with Paper, world management, and economy plugins pre-configured.",
    software: "Paper 1.21.4",
    ram: 2048,
    cpu: 100,
    disk: 10240,
    tags: ["PvE", "Economy", "World Management"],
    popular: true,
  },
  {
    name: "Creative Plot",
    description: "Flat creative world with per-player plots, WorldEdit access, and a clean spawn.",
    software: "Paper 1.21.4",
    ram: 1024,
    cpu: 50,
    disk: 5120,
    tags: ["Creative", "Plots", "WorldEdit"],
    popular: false,
  },
  {
    name: "Minigames Hub",
    description: "Proxy-connected hub server with lobby plugins and server selector NPC.",
    software: "Velocity 3.4.0",
    ram: 512,
    cpu: 25,
    disk: 2048,
    tags: ["Proxy", "Hub", "Minigames"],
    popular: false,
  },
  {
    name: "Vanilla+",
    description: "Lightly modified vanilla experience with Fabric and a small set of QoL mods.",
    software: "Vanilla 1.21.4",
    ram: 2048,
    cpu: 100,
    disk: 8192,
    tags: ["Vanilla", "Fabric", "QoL"],
    popular: false,
  },
  {
    name: "Bedrock Survival",
    description: "Official Bedrock Dedicated Server for cross-platform play (Win/Mobile/Console).",
    software: "Bedrock 1.21.50",
    ram: 1024,
    cpu: 50,
    disk: 5120,
    tags: ["Bedrock", "Cross-Platform"],
    popular: false,
  },
  {
    name: "Minimal (blank)",
    description: "Bare-bones server with no pre-installed plugins. Choose your own setup.",
    software: "Paper 1.21.4",
    ram: 512,
    cpu: 25,
    disk: 2048,
    tags: ["Blank"],
    popular: false,
  },
];

export default function TemplatesPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copyId(name: string) {
    navigator.clipboard.writeText(name.toLowerCase().replace(/\s/g, "-"));
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>Templates</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Pre-configured server setups. Apply when creating a new server.
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full font-medium"
          style={{ backgroundColor: "rgba(163,230,53,0.08)", color: "var(--color-rp-accent)", border: "1px solid rgba(163,230,53,0.2)" }}>
          {TEMPLATES.length} templates
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TEMPLATES.map(t => (
          <div key={t.name} className="rounded-xl border flex flex-col"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
            <div className="p-5 flex-1">
              <div className="flex items-start gap-2 mb-2">
                <h3 className="font-semibold flex-1" style={{ color: "var(--color-rp-text)" }}>{t.name}</h3>
                {t.popular && (
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: "rgba(163,230,53,0.15)", color: "var(--color-rp-accent)" }}>
                    Popular
                  </span>
                )}
              </div>
              <p className="text-xs mb-4" style={{ color: "var(--color-rp-text-muted)" }}>{t.description}</p>
              <div className="space-y-1.5 text-xs">
                {[
                  ["Software", t.software],
                  ["RAM", `${t.ram} MB`],
                  ["CPU", `${t.cpu}%`],
                  ["Disk", `${Math.round(t.disk / 1024)} GB`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={{ color: "var(--color-rp-text-muted)" }}>{k}</span>
                    <span style={{ color: "var(--color-rp-text)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {t.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-text-dim)", border: "1px solid var(--color-rp-border)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-between"
              style={{ borderColor: "var(--color-rp-border)", backgroundColor: "var(--color-rp-surface-2)" }}>
              <span className="text-xs" style={{ color: "var(--color-rp-text-dim)" }}>Use when creating a server</span>
              <button onClick={() => copyId(t.name)} className="flex items-center gap-1 text-xs" style={{ color: "var(--color-rp-accent)" }}>
                {copied === t.name ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy ID</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border-2)" }}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--color-rp-accent)" }} />
          <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
            Custom templates can be created by selecting "Save as Template" when creating a server. Template editor and import/export coming in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
