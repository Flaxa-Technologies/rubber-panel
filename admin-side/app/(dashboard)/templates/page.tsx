"use client";

import { useEffect, useState } from "react";
import {
  FileCode2, Copy, Check, Info, Plus, Upload, Trash2, ShieldCheck,
  HardDrive, Cpu, Layers, Sparkles, AlertCircle, X, Download, Flame, Box
} from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  softwareName?: string | null;
  softwareType?: string | null;
  version?: string | null;
  defaultRam: number;
  defaultCpu: number;
  defaultDisk: number;
  dockerImage?: string | null;
  zipPath?: string | null;
  zipSize?: number | null;
  tags: string; // JSON array
  isOfficial: boolean;
  createdAt: string;
  _count?: { servers: number };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Upload modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    softwareName: "Paper",
    version: "1.21.4",
    defaultRam: 2048,
    defaultCpu: 100,
    defaultDisk: 5120,
    tags: "SMP, Custom",
  });

  async function loadTemplates() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err: any) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function copyId(name: string) {
    navigator.clipboard.writeText(name.toLowerCase().replace(/\s/g, "-"));
    setCopied(name);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg("Template name is required");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");

      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("softwareName", form.softwareName);
      formData.append("softwareType", form.softwareName.toUpperCase());
      formData.append("version", form.version.trim());
      formData.append("defaultRam", form.defaultRam.toString());
      formData.append("defaultCpu", form.defaultCpu.toString());
      formData.append("defaultDisk", form.defaultDisk.toString());
      formData.append("tags", form.tags);

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const res = await fetch("/api/admin/templates", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || "Template uploaded successfully!");
        await loadTemplates();
        setTimeout(() => {
          setShowModal(false);
          setSuccessMsg("");
          setSelectedFile(null);
          setForm({
            name: "",
            description: "",
            softwareName: "Paper",
            version: "1.21.4",
            defaultRam: 2048,
            defaultCpu: 100,
            defaultDisk: 5120,
            tags: "SMP, Custom",
          });
        }, 1500);
      } else {
        setErrorMsg(data.error || "Failed to upload template");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Upload request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete template "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadTemplates();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete template");
      }
    } catch (err: any) {
      alert(err?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-12">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-lime-500/15 border border-lime-500/30 flex items-center justify-center text-lime-400">
              <FileCode2 className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>
              Server Templates
            </h1>
          </div>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
            Pre-configured server blueprints and modpacks. Upload custom ZIP archives with automatic root config sanitization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setErrorMsg("");
              setSuccessMsg("");
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 bg-lime-500 text-black hover:bg-lime-400"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Custom Template</span>
          </button>
        </div>
      </div>

      {/* ─── TEMPLATES GRID ─── */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading templates catalog...</div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 space-y-3">
          <FileCode2 className="w-10 h-10 text-zinc-500 mx-auto" />
          <p className="text-sm font-semibold text-zinc-400">No templates found in library.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-lime-500 text-black hover:bg-lime-400 transition-colors"
          >
            Upload Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const tagsList: string[] = (() => {
              try { return JSON.parse(t.tags || "[]"); } catch { return []; }
            })();

            const isPumpkin = t.softwareName?.toLowerCase().includes("pumpkin") || t.softwareType === "PUMPKIN";

            return (
              <div
                key={t.id}
                className="rounded-2xl border flex flex-col justify-between transition-all hover:border-lime-500/40 shadow-sm relative overflow-hidden group"
                style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
              >
                <div className="p-5 space-y-3 flex-1">
                  {/* Top Bar: Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                        {isPumpkin && <Flame className="w-4 h-4 text-orange-400" />}
                        <span>{t.name}</span>
                      </h3>
                      <span className="text-[11px] text-zinc-400 block pt-0.5 font-mono">
                        {t.softwareName || "Minecraft"} {t.version || "1.21.4"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {t.isOfficial ? (
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/30">
                          OFFICIAL
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          CUSTOM
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {t.description || "No description provided."}
                  </p>

                  {/* Tags */}
                  {tagsList.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {tagsList.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Resource Specs */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Layers className="w-3.5 h-3.5 text-lime-400" />
                      <span>{t.defaultRam} MB RAM</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Cpu className="w-3.5 h-3.5 text-sky-400" />
                      <span>{t.defaultCpu}% CPU</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span>{Math.round(t.defaultDisk / 1024)} GB Disk</span>
                    </div>
                  </div>
                </div>

                {/* Footer Bar */}
                <div
                  className="px-5 py-3 border-t flex items-center justify-between gap-3 text-xs bg-black/20"
                  style={{ borderColor: "var(--color-rp-border)" }}
                >
                  <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                    {t.zipSize ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Download className="w-3 h-3" />
                        <span>{(t.zipSize / 1024 / 1024).toFixed(1)} MB ZIP</span>
                      </span>
                    ) : (
                      <span>Pre-configured Engine</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!t.isOfficial && (
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── UPLOAD MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-lg rounded-3xl border shadow-2xl p-6 relative overflow-hidden space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--color-rp-border)" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-lime-500/20 text-lime-400 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Upload Minecraft Template</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              {/* Name */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Template Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Custom Skyblock 1.21.4"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none bg-black/40 text-white focus:border-lime-400 transition-all"
                  style={{ borderColor: "var(--color-rp-border)" }}
                />
              </div>

              {/* Software & Version */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-300">Target Software</label>
                  <select
                    value={form.softwareName}
                    onChange={(e) => setForm((f) => ({ ...f, softwareName: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border outline-none bg-black/40 text-white focus:border-lime-400 transition-all"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  >
                    <option value="Paper">Paper</option>
                    <option value="Purpur">Purpur</option>
                    <option value="Fabric">Fabric</option>
                    <option value="Forge">Forge</option>
                    <option value="NeoForge">NeoForge</option>
                    <option value="Pumpkin">Pumpkin (Rust MC)</option>
                    <option value="Vanilla">Vanilla</option>
                    <option value="Velocity">Velocity Proxy</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-300">Minecraft Version</label>
                  <input
                    type="text"
                    placeholder="1.21.4"
                    value={form.version}
                    onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border outline-none bg-black/40 text-white focus:border-lime-400 transition-all"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  />
                </div>
              </div>

              {/* Resource Defaults */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-400">RAM (MB)</label>
                  <input
                    type="number"
                    min={256}
                    step={128}
                    value={form.defaultRam}
                    onChange={(e) => setForm((f) => ({ ...f, defaultRam: parseInt(e.target.value) || 2048 }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none bg-black/40 text-white"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-400">CPU Limit (%)</label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={form.defaultCpu}
                    onChange={(e) => setForm((f) => ({ ...f, defaultCpu: parseInt(e.target.value) || 100 }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none bg-black/40 text-white"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-400">Disk (MB)</label>
                  <input
                    type="number"
                    min={1024}
                    step={1024}
                    value={form.defaultDisk}
                    onChange={(e) => setForm((f) => ({ ...f, defaultDisk: parseInt(e.target.value) || 5120 }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none bg-black/40 text-white"
                    style={{ borderColor: "var(--color-rp-border)" }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe plugins, world, and features..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border outline-none bg-black/40 text-white focus:border-lime-400 transition-all resize-none"
                  style={{ borderColor: "var(--color-rp-border)" }}
                />
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-300">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="SMP, Quests, Economy"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border outline-none bg-black/40 text-white focus:border-lime-400 transition-all"
                  style={{ borderColor: "var(--color-rp-border)" }}
                />
              </div>

              {/* File Upload & Auto-Sanitizer Banner */}
              <div className="space-y-2 pt-1">
                <label className="font-bold text-zinc-300">Template Archive (.zip) *</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-lime-500 file:text-black hover:file:bg-lime-400 cursor-pointer"
                />

                <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-300 text-[11px] flex items-start gap-2 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-lime-400 mt-0.5" />
                  <span>
                    <strong>Auto-Sanitizer Active:</strong> Any root <code>server.properties</code>, <code>configuration.toml</code>, or <code>config.toml</code> inside your ZIP will be automatically deleted upon upload so dynamic panel ports and IP routing remain untampered.
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl font-bold bg-lime-500 text-black hover:bg-lime-400 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{submitting ? "Sanitizing & Uploading..." : "Save Template"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
