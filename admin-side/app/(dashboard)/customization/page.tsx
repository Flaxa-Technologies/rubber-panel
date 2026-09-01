"use client";

import { useEffect, useState, useRef } from "react";
import {
  Palette, Save, RefreshCw, Check, Sparkles, MessageCircle,
  Globe, ShieldAlert, Plus, Trash2, Video, Camera, Share2,
  Sliders, Eye, Layout, ExternalLink, Megaphone, CheckCircle2, Code2,
  Upload, Image as ImageIcon, RotateCcw, FileCheck
} from "lucide-react";
import Image from "next/image";
import { ADVANCED_CSS_THEMES } from "@/lib/css-themes";

function YoutubeIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TwitterIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface CustomLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}

const THEME_PRESETS = [
  { id: "onyx", name: "Onyx (Pure B&W)", accent: "#ffffff", previewBg: "#000000", border: "#27272a" },
  { id: "midnight", name: "Midnight Slate", accent: "#38bdf8", previewBg: "#0b0f19", border: "#1e293b" },
  { id: "emerald", name: "Matrix Emerald", accent: "#10b981", previewBg: "#06130b", border: "#143923" },
  { id: "purple", name: "Cyberpunk Violet", accent: "#a855f7", previewBg: "#0d0b1a", border: "#2e1065" },
  { id: "crimson", name: "Crimson Ember", accent: "#f43f5e", previewBg: "#160b0e", border: "#3f131d" },
  { id: "amber", name: "Solar Amber", accent: "#f59e0b", previewBg: "#140f06", border: "#38290c" },
];

const AVAILABLE_ICONS = ["MessageCircle", "Globe", "Youtube", "Instagram", "Twitter", "ExternalLink", "ShieldAlert", "Code2"];

export default function CustomizationPage() {
  const [activeTab, setActiveTab] = useState<"branding" | "social" | "theme" | "features">("branding");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({
    "branding.siteName": "Rubber Panel",
    "branding.siteDescription": "Next-Generation Game Server Platform",
    "branding.logoUrl": "/logo.png",
    "branding.faviconUrl": "/favicon.ico",
    "branding.footerText": "Powered by Rubber Panel & Flaxa Studios",
    "branding.themePreset": "onyx",
    "branding.accentColor": "#ffffff",
    "branding.navbarStyle": "blur",
    "branding.customCss": "",

    "social.discord": "https://discord.gg/rubberpanel",
    "social.youtube": "",
    "social.instagram": "",
    "social.twitter": "",
    "social.website": "https://hostadmin.net",
    "social.supportUrl": "https://discord.gg/rubberpanel",
    "social.customLinks": "[]",

    "features.showDiscordButton": "true",
    "features.suspendedDiscordCta": "true",
    "features.announcementEnabled": "false",
    "features.announcementTitle": "Welcome to the Platform",
    "features.announcementMessage": "Join our official community on Discord for support and updates!",
  });

  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const d = await res.json();
        setSettings(prev => ({ ...prev, ...(d.settings || {}) }));
        try {
          const links = JSON.parse(d.settings?.["social.customLinks"] || "[]");
          setCustomLinks(Array.isArray(links) ? links : []);
        } catch {
          setCustomLinks([]);
        }
      }
    } catch {
      setError("Failed to load customization settings");
    }
    setLoading(false);
  }

  useEffect(() => { loadSettings(); }, []);

  function updateKey(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleFileUpload(file: File, type: "logo" | "favicon") {
    if (type === "logo") setUploadingLogo(true);
    else setUploadingFavicon(true);
    setError("");
    setUploadMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const res = await fetch("/api/admin/customization/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        updateKey(data.key, data.url);
        setUploadMsg(`${type === "logo" ? "Logo" : "Favicon"} uploaded and applied live!`);
        setTimeout(() => setUploadMsg(""), 4000);
      } else {
        setError(data.error || `Failed to upload ${type}`);
      }
    } catch {
      setError(`Network error uploading ${type}`);
    }

    if (type === "logo") setUploadingLogo(false);
    else setUploadingFavicon(false);
  }

  function addCustomLink() {
    const newLink: CustomLink = {
      id: Date.now().toString(),
      label: "Documentation",
      url: "https://",
      icon: "Globe",
    };
    const updated = [...customLinks, newLink];
    setCustomLinks(updated);
    updateKey("social.customLinks", JSON.stringify(updated));
  }

  function removeCustomLink(id: string) {
    const updated = customLinks.filter(l => l.id !== id);
    setCustomLinks(updated);
    updateKey("social.customLinks", JSON.stringify(updated));
  }

  function updateCustomLink(id: string, field: keyof CustomLink, val: string) {
    const updated = customLinks.map(l => l.id === id ? { ...l, [field]: val } : l);
    setCustomLinks(updated);
    updateKey("social.customLinks", JSON.stringify(updated));
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...settings,
      "social.customLinks": JSON.stringify(customLinks),
    };

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const d = await res.json();
        setError(d.error || "Failed to save settings");
      }
    } catch {
      setError("Network error while saving settings");
    }
    setSaving(false);
  }

  const selectedPreset = THEME_PRESETS.find(p => p.id === settings["branding.themePreset"]) || THEME_PRESETS[0];

  return (
    <div className="space-y-6 w-full animate-fade-in pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: "var(--color-rp-text)" }}>
            <Palette className="w-6 h-6" style={{ color: "var(--color-rp-accent)" }} />
            <span>Customization & Branding</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Tailor site identity, custom logos, colors, community links, Discord CTAs, and announcement banners.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSettings}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border hover:bg-white/5 transition-colors"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 shadow-md"
            style={{
              backgroundColor: saved ? "var(--color-rp-green)" : "var(--color-rp-accent)",
              color: "#000"
            }}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saved ? "Saved Live!" : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {uploadMsg && (
        <div className="p-3 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
          {uploadMsg}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-2 p-1.5 rounded-xl border bg-black/40" style={{ borderColor: "var(--color-rp-border)" }}>
        {[
          { id: "branding", label: "Branding & Identity", icon: Sparkles },
          { id: "social", label: "Social & Community", icon: MessageCircle },
          { id: "theme", label: "Color Theme & Styles", icon: Sliders },
          { id: "features", label: "User Features & CTAs", icon: ShieldAlert },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={
                active
                  ? { backgroundColor: "var(--color-rp-accent-glow)", color: "var(--color-rp-accent)", border: "1px solid var(--color-rp-accent)" }
                  : { color: "var(--color-rp-text-muted)", border: "1px solid transparent" }
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={logoInputRef}
        className="hidden"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, "logo");
        }}
      />
      <input
        type="file"
        ref={faviconInputRef}
        className="hidden"
        accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, "favicon");
        }}
      />

      {/* Main Grid: Form + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form Settings (2 Cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* TAB 1: Branding & Identity */}
          {activeTab === "branding" && (
            <div className="p-6 rounded-2xl border space-y-6" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Platform Identity & Assets</span>
                </h3>
              </div>

              {/* 1. Logo Asset Management */}
              <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    <span>Panel Logo</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">Recommended: PNG / SVG with transparent background</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                  {/* Logo Preview Box */}
                  <div
                    className="w-16 h-16 rounded-xl border flex items-center justify-center p-2 relative bg-black/40 overflow-hidden shrink-0"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  >
                    <Image
                      src={settings["branding.logoUrl"] || "/logo.png"}
                      alt="Logo Preview"
                      width={48}
                      height={48}
                      className="object-contain max-h-full max-w-full"
                      unoptimized
                    />
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/10 active:scale-95 shadow-sm"
                        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                      >
                        {uploadingLogo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-sky-400" />}
                        <span>{uploadingLogo ? "Uploading..." : "Upload New Logo"}</span>
                      </button>

                      {settings["branding.logoUrl"] !== "/logo.png" && (
                        <button
                          type="button"
                          onClick={() => updateKey("branding.logoUrl", "/logo.png")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border text-zinc-400 hover:text-white transition-colors"
                          style={{ borderColor: "var(--color-rp-border)" }}
                        >
                          <RotateCcw className="w-3 h-3" /> Reset Default
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={settings["branding.logoUrl"] || ""}
                      onChange={e => updateKey("branding.logoUrl", e.target.value)}
                      placeholder="/logo.png or https://..."
                      className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Site Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>
                    Panel Name
                  </label>
                  <input
                    type="text"
                    value={settings["branding.siteName"] || ""}
                    onChange={e => updateKey("branding.siteName", e.target.value)}
                    placeholder="Rubber Panel"
                    className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-medium"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                  <p className="text-[11px] mt-1 text-zinc-500">Displayed in sidebar, page titles, and browser tabs.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>
                    Favicon (.ico / .png)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settings["branding.faviconUrl"] || "/favicon.ico"}
                      onChange={e => updateKey("branding.faviconUrl", e.target.value)}
                      placeholder="/favicon.ico"
                      className="w-full px-3 py-2 rounded-lg text-xs border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                    <button
                      type="button"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={uploadingFavicon}
                      className="p-2 rounded-lg border text-xs shrink-0 hover:bg-white/10"
                      style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                      title="Upload Favicon"
                    >
                      {uploadingFavicon ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>
                  Site Description & Tagline
                </label>
                <input
                  type="text"
                  value={settings["branding.siteDescription"] || ""}
                  onChange={e => updateKey("branding.siteDescription", e.target.value)}
                  placeholder="Next-Generation Cloud Game Server Management"
                  className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-medium"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>
                  Footer Copyright / Powered By Attribution
                </label>
                <input
                  type="text"
                  value={settings["branding.footerText"] || ""}
                  onChange={e => updateKey("branding.footerText", e.target.value)}
                  placeholder="Powered by Rubber Panel & Flaxa Studios"
                  className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-medium"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Social & Community Links */}
          {activeTab === "social" && (
            <div className="p-6 rounded-2xl border space-y-5" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
                  <MessageCircle className="w-4 h-4 text-indigo-400" />
                  <span>Community & Social Channels</span>
                </h3>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "#818cf8" }}>
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Official Discord Invite Link</span>
                  </label>
                  <input
                    type="text"
                    value={settings["social.discord"] || ""}
                    onChange={e => updateKey("social.discord", e.target.value)}
                    placeholder="https://discord.gg/yourserver"
                    className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                  <p className="text-xs mt-1" style={{ color: "var(--color-rp-text-dim)" }}>
                    Used for the &quot;Join Discord&quot; navbar button and suspended instance support CTA.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "#f87171" }}>
                      <YoutubeIcon className="w-3.5 h-3.5" />
                      <span>YouTube Channel URL</span>
                    </label>
                    <input
                      type="text"
                      value={settings["social.youtube"] || ""}
                      onChange={e => updateKey("social.youtube", e.target.value)}
                      placeholder="https://youtube.com/@channel"
                      className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "#f472b6" }}>
                      <InstagramIcon className="w-3.5 h-3.5" />
                      <span>Instagram Profile URL</span>
                    </label>
                    <input
                      type="text"
                      value={settings["social.instagram"] || ""}
                      onChange={e => updateKey("social.instagram", e.target.value)}
                      placeholder="https://instagram.com/profile"
                      className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "#60a5fa" }}>
                      <TwitterIcon className="w-3.5 h-3.5" />
                      <span>Twitter / X Profile URL</span>
                    </label>
                    <input
                      type="text"
                      value={settings["social.twitter"] || ""}
                      onChange={e => updateKey("social.twitter", e.target.value)}
                      placeholder="https://x.com/username"
                      className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "#34d399" }}>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Official Website / Portal URL</span>
                    </label>
                    <input
                      type="text"
                      value={settings["social.website"] || ""}
                      onChange={e => updateKey("social.website", e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className="w-full px-3.5 py-2 rounded-lg text-sm border outline-none font-mono"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Links Builder */}
              <div className="pt-4 border-t space-y-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                      Additional Custom Links
                    </h4>
                    <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      Add custom navigation links with icons to the user sidebar footer.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-white/5 transition-colors"
                    style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-accent)" }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Link
                  </button>
                </div>

                {customLinks.length === 0 ? (
                  <div className="p-4 rounded-xl border text-center text-xs" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-dim)" }}>
                    No custom links added yet. Click &quot;Add Link&quot; above to create one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 p-2.5 rounded-xl border"
                        style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}
                      >
                        <select
                          value={link.icon}
                          onChange={e => updateCustomLink(link.id, "icon", e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                        >
                          {AVAILABLE_ICONS.map(ic => (
                            <option key={ic} value={ic}>{ic}</option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={link.label}
                          onChange={e => updateCustomLink(link.id, "label", e.target.value)}
                          placeholder="Label (e.g. Wiki)"
                          className="w-32 px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                        />

                        <input
                          type="text"
                          value={link.url}
                          onChange={e => updateCustomLink(link.id, "url", e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-2.5 py-1.5 rounded-lg text-xs border outline-none font-mono"
                          style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                        />

                        <button
                          type="button"
                          onClick={() => removeCustomLink(link.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Color Theme & Styling */}
          {activeTab === "theme" && (
            <div className="p-6 rounded-2xl border space-y-5" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Theme Presets & Palette</span>
              </h3>

              {/* Theme Presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-rp-text-dim)" }}>
                  Curated Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEME_PRESETS.map((preset) => {
                    const active = settings["branding.themePreset"] === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          updateKey("branding.themePreset", preset.id);
                          updateKey("branding.accentColor", preset.accent);
                        }}
                        className="p-3.5 rounded-xl border text-left transition-all relative overflow-hidden"
                        style={{
                          backgroundColor: preset.previewBg,
                          borderColor: active ? preset.accent : preset.border,
                          boxShadow: active ? `0 0 14px ${preset.accent}33` : "none",
                        }}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: preset.accent }} />
                        )}
                        <div className="w-5 h-5 rounded-full mb-2" style={{ backgroundColor: preset.accent }} />
                        <div className="text-xs font-bold" style={{ color: "#ffffff" }}>
                          {preset.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Accent Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>
                    Custom Accent Color
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={settings["branding.accentColor"] || "#ffffff"}
                      onChange={e => updateKey("branding.accentColor", e.target.value)}
                      className="w-10 h-9 rounded-lg border cursor-pointer bg-transparent p-0.5"
                      style={{ borderColor: "var(--color-rp-border)" }}
                    />
                    <input
                      type="text"
                      value={settings["branding.accentColor"] || "#ffffff"}
                      onChange={e => updateKey("branding.accentColor", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none font-mono uppercase"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-rp-text-dim)" }}>
                    Header / Navbar Style
                  </label>
                  <select
                    value={settings["branding.navbarStyle"] || "blur"}
                    onChange={e => updateKey("branding.navbarStyle", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-medium"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <option value="blur">Glassmorphic Blur (Modern)</option>
                    <option value="solid">Solid Elevated Black</option>
                    <option value="minimal">Ultra Minimalist Bordered</option>
                  </select>
                </div>
              </div>

              {/* Custom CSS Injection with Templates */}
              <div className="pt-4 border-t space-y-3" style={{ borderColor: "var(--color-rp-border)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-rp-text)" }}>
                    <Code2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Custom CSS Overrides</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">Injected dynamically into the user portal &lt;head&gt;</span>
                </div>

                {/* Quick CSS Template Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-lime-400" />
                      <span>Choose an Advanced CSS Design Theme:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => updateKey("branding.customCss", "")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset / Clear to Default
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {ADVANCED_CSS_THEMES.map((theme) => {
                      const isCurrent = settings["branding.customCss"] === theme.css;
                      const gradients: Record<string, string> = {
                        "aurora-void": "linear-gradient(135deg, #06040f 0%, #1a0533 40%, #0c1f4a 60%, #7c3aed22 100%)",
                        "cyber-tokyo": "linear-gradient(135deg, #03010a 0%, #ff008015 35%, #00f0ff15 65%, #120030 100%)",
                        "royal-onyx": "linear-gradient(135deg, #050301 0%, #fbbf2418 45%, #d9770612 70%, #0b0702 100%)",
                        "quantum-emerald": "linear-gradient(135deg, #000802 0%, #00ff8818 40%, #10b98115 65%, #030f05 100%)",
                      };
                      const animDots: Record<string, string[]> = {
                        "aurora-void": ["#7c3aed", "#06b6d4", "#ec4899"],
                        "cyber-tokyo": ["#ff0080", "#00f0ff", "#ff4040"],
                        "royal-onyx": ["#fbbf24", "#d97706", "#f59e0b"],
                        "quantum-emerald": ["#00ff88", "#10b981", "#34d399"],
                      };
                      const dots = animDots[theme.id] || ["#ffffff", "#aaaaaa", "#666666"];
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => updateKey("branding.customCss", theme.css)}
                          className="p-0 rounded-2xl border text-left transition-all relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            borderColor: isCurrent ? theme.previewColor : "rgba(255,255,255,0.1)",
                            boxShadow: isCurrent ? `0 0 24px ${theme.previewColor}44, 0 0 50px ${theme.previewColor}18` : "0 4px 20px rgba(0,0,0,0.5)"
                          }}
                        >
                          {/* Animated preview area */}
                          <div
                            className="relative h-24 w-full overflow-hidden"
                            style={{ background: gradients[theme.id] || gradients["aurora-void"] }}
                          >
                            {/* Simulated sidebar strip */}
                            <div className="absolute left-0 top-0 bottom-0 w-9 opacity-60" style={{ background: "rgba(0,0,0,0.6)", borderRight: `1px solid ${theme.previewColor}33` }} />
                            {/* Simulated topbar strip */}
                            <div className="absolute top-0 left-9 right-0 h-7 opacity-50" style={{ background: "rgba(0,0,0,0.5)", borderBottom: `1px solid ${theme.previewColor}33` }} />
                            {/* Mini card blobs */}
                            <div className="absolute top-10 left-12 right-3 h-6 rounded-md opacity-50" style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${theme.previewColor}30` }} />
                            <div className="absolute bottom-2 left-12 w-16 h-4 rounded opacity-40" style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${theme.previewColor}25` }} />
                            {/* Color orbs */}
                            {dots.map((c, i) => (
                              <div key={i} className="absolute rounded-full opacity-40 blur-xl" style={{
                                width: 50, height: 50,
                                background: c,
                                top: i === 0 ? "10%" : i === 1 ? "60%" : "30%",
                                left: i === 0 ? "50%" : i === 1 ? "75%" : "25%",
                              }} />
                            ))}
                            {/* Active badge overlay */}
                            {isCurrent && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1" style={{ background: `${theme.previewColor}33`, border: `1px solid ${theme.previewColor}`, color: theme.previewColor }}>
                                  <Check className="w-3 h-3" />
                                  <span>ACTIVE</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Card body */}
                          <div className="p-3.5" style={{ background: "rgba(12,10,18,0.95)" }}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-xs text-white group-hover:opacity-80 transition-opacity flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: theme.previewColor, boxShadow: `0 0 6px ${theme.previewColor}` }} />
                                {theme.name}
                              </span>
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono border shrink-0"
                                style={{
                                  backgroundColor: `${theme.previewColor}18`,
                                  borderColor: `${theme.previewColor}44`,
                                  color: theme.previewColor
                                }}
                              >
                                {theme.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">{theme.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-400">Live CSS Code Editor:</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Supports standard CSS, variables & @keyframes</span>
                  </div>
                  <textarea
                    rows={8}
                    value={settings["branding.customCss"] || ""}
                    onChange={e => updateKey("branding.customCss", e.target.value)}
                    placeholder="/* Custom CSS overrides for user portal — e.g. custom font imports, card glows, custom backgrounds */"
                    className="w-full p-3 rounded-xl text-xs font-mono border outline-none leading-relaxed"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: User Features & CTAs */}
          {activeTab === "features" && (
            <div className="p-6 rounded-2xl border space-y-5" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--color-rp-text)" }}>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Feature Toggles & Support CTAs</span>
              </h3>

              <div className="space-y-4">
                {/* Discord Button in Header Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                      Show &quot;Join Discord&quot; Top Button
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      Places a direct Discord invite button in the user top navigation bar.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings["features.showDiscordButton"] === "true"}
                    onChange={e => updateKey("features.showDiscordButton", e.target.checked ? "true" : "false")}
                    className="w-4 h-4 rounded cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Suspended Server CTA */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>
                      Suspended Server &quot;Contact Us on Discord&quot; CTA
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                      When a user&apos;s server is suspended, display a prominent Discord support banner on their instance page.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings["features.suspendedDiscordCta"] === "true"}
                    onChange={e => updateKey("features.suspendedDiscordCta", e.target.checked ? "true" : "false")}
                    className="w-4 h-4 rounded cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Announcement Banner */}
                <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)" }}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-rp-text)" }}>
                      <Megaphone className="w-4 h-4 text-emerald-400" />
                      <span>User Announcement Banner</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings["features.announcementEnabled"] === "true"}
                      onChange={e => updateKey("features.announcementEnabled", e.target.checked ? "true" : "false")}
                      className="w-4 h-4 rounded cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {settings["features.announcementEnabled"] === "true" && (
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        value={settings["features.announcementTitle"] || ""}
                        onChange={e => updateKey("features.announcementTitle", e.target.value)}
                        placeholder="Banner Title"
                        className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none font-medium"
                        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                      />
                      <textarea
                        rows={2}
                        value={settings["features.announcementMessage"] || ""}
                        onChange={e => updateKey("features.announcementMessage", e.target.value)}
                        placeholder="Banner Message..."
                        className="w-full p-3 rounded-lg text-xs border outline-none"
                        style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Interactive User Panel Mockup Preview */}
        <div className="p-5 rounded-2xl border space-y-4 sticky top-6" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
            <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-rp-text-muted)" }}>
              <Eye className="w-3.5 h-3.5" />
              <span>Live User Preview</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-accent)" }}>
              {selectedPreset.name}
            </span>
          </div>

          {/* Mini Mockup Container */}
          <div
            className="rounded-xl border overflow-hidden text-xs shadow-2xl transition-all"
            style={{
              backgroundColor: selectedPreset.previewBg,
              borderColor: selectedPreset.border,
              color: "#f4f4f5"
            }}
          >
            {/* Topbar in Mockup */}
            <div
              className="px-3 py-2.5 border-b flex items-center justify-between"
              style={{
                borderColor: selectedPreset.border,
                backgroundColor: settings["branding.navbarStyle"] === "blur" ? "rgba(255,255,255,0.03)" : "transparent"
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings["branding.accentColor"] || "#ffffff" }} />
                <span className="font-bold text-xs" style={{ color: "#ffffff" }}>
                  {settings["branding.siteName"] || "Rubber Panel"}
                </span>
              </div>

              {settings["features.showDiscordButton"] === "true" && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold"
                  style={{ backgroundColor: "#5865F2", color: "#ffffff" }}
                >
                  <MessageCircle className="w-2.5 h-2.5" />
                  <span>Discord</span>
                </div>
              )}
            </div>

            {/* Mock Content */}
            <div className="p-3.5 space-y-2.5">
              {/* Suspended CTA preview */}
              {settings["features.suspendedDiscordCta"] === "true" && (
                <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 space-y-1.5">
                  <div className="font-bold text-[11px] text-red-400 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Instance Suspended
                  </div>
                  <p className="text-[10px] text-zinc-300">
                    Contact our administration team for account or payment resolution.
                  </p>
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ backgroundColor: "#5865F2", color: "#ffffff" }}
                  >
                    <MessageCircle className="w-2.5 h-2.5" /> Contact on Discord
                  </div>
                </div>
              )}

              {/* Instance Card Mock */}
              <div
                className="p-2.5 rounded-lg border space-y-1.5"
                style={{ borderColor: selectedPreset.border, backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">Survival SMP</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-[10px] font-mono text-zinc-400">
                  play.server.com:25566
                </div>
                <div
                  className="w-full py-1 rounded text-center text-[10px] font-bold"
                  style={{ backgroundColor: settings["branding.accentColor"] || "#ffffff", color: "#000000" }}
                >
                  Manage Instance
                </div>
              </div>
            </div>

            {/* Mock Footer */}
            <div className="px-3 py-1.5 border-t text-[9px] text-center font-medium" style={{ borderColor: selectedPreset.border, color: "#71717a" }}>
              {settings["branding.footerText"] || "Powered by Rubber Panel"}
            </div>
          </div>

          <div className="text-[11px] leading-relaxed p-3 rounded-xl border bg-black/20" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
            Changes apply in real-time to all connected users upon clicking <strong>Save Changes</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}
