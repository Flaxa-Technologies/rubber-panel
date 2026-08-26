"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Folder, FileText, Trash2, Edit2, FilePlus, FolderPlus,
  ArrowLeft, Loader2, Save, ChevronRight, Home, Lock, ShieldOff,
  Upload, Archive, ShieldCheck, CheckCircle2
} from "lucide-react";
import type { FileEntry } from "@/lib/types";
import { formatBytes } from "@/lib/server-utils";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

interface FileManagerPanelProps {
  serverId: string;
  allowedPaths?: string;
  protectedPaths?: string;
  blockedUploadPaths?: string;
}

export default function FileManagerPanel({ serverId, allowedPaths, protectedPaths, blockedUploadPaths }: FileManagerPanelProps) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";

  const [adminBypass, setAdminBypass] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [promptingCreate, setPromptingCreate] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowedList = useMemo<string[]>(() => {
    if (!allowedPaths) return [];
    try {
      if (allowedPaths.startsWith("[")) return JSON.parse(allowedPaths);
      return allowedPaths.split(",").map(s => s.trim()).filter(Boolean);
    } catch {
      return allowedPaths.split(",").map(s => s.trim()).filter(Boolean);
    }
  }, [allowedPaths]);

  const protectedList = useMemo<string[]>(() => {
    if (!protectedPaths) return [];
    try {
      if (protectedPaths.startsWith("[")) return JSON.parse(protectedPaths);
      return protectedPaths.split(",").map(s => s.trim()).filter(Boolean);
    } catch {
      return protectedPaths.split(",").map(s => s.trim()).filter(Boolean);
    }
  }, [protectedPaths]);

  const blockedUploadList = useMemo<string[]>(() => {
    if (!blockedUploadPaths) return [];
    try {
      if (blockedUploadPaths.startsWith("[")) return JSON.parse(blockedUploadPaths);
      return blockedUploadPaths.split(",").map(s => s.trim()).filter(Boolean);
    } catch {
      return blockedUploadPaths.split(",").map(s => s.trim()).filter(Boolean);
    }
  }, [blockedUploadPaths]);

  function isPathAllowed(path: string): boolean {
    if (isAdmin && adminBypass) return true;
    if (allowedList.length === 0) return true;
    return allowedList.some(allowed =>
      allowed === "/" || allowed === "" || path === allowed || path.startsWith(allowed === "/" ? "/" : allowed + "/") || allowed.startsWith(path)
    );
  }

  function isProtected(filePath: string): boolean {
    if (isAdmin && adminBypass) return false;
    if (protectedList.length === 0) return false;
    return protectedList.some(p =>
      filePath === p || filePath.startsWith(p + "/")
    );
  }

  function isUploadBlocked(filePath: string): boolean {
    if (isAdmin && adminBypass) return false;
    if (blockedUploadList.length === 0) return false;
    return blockedUploadList.some(p =>
      filePath === p || filePath.startsWith(p + "/") || p.startsWith(filePath + "/") || currentPath === p || currentPath.startsWith(p + "/")
    );
  }

  function buildPath(filename: string) {
    return (currentPath === "/" ? "/" : currentPath + "/") + filename;
  }

  const canWriteHere = isPathAllowed(currentPath);
  const canUploadHere = canWriteHere && !isUploadBlocked(currentPath);

  function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAdmin && adminBypass) {
      headers["X-Bypass-Restrictions"] = "true";
    }
    return headers;
  }

  async function loadFiles(path: string) {
    setLoading(true);
    setError("");
    setCurrentPath(path);
    try {
      const res = await fetch(`/api/user/servers/${serverId}/files?path=${encodeURIComponent(path)}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to load directory.");
      }
    } catch {
      setError("Failed to connect to daemon.");
    }
    setLoading(false);
  }

  useEffect(() => { loadFiles("/"); }, [serverId, adminBypass]);

  async function openEditor(filename: string) {
    const fullPath = buildPath(filename);
    try {
      const res = await fetch(`/api/user/servers/${serverId}/files?action=read&path=${encodeURIComponent(fullPath)}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setEditingFile({ path: fullPath, content: data.content });
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Cannot open protected or binary file.");
      }
    } catch {
      setError("Failed to read file.");
    }
  }

  async function saveFile() {
    if (!editingFile) return;
    if (isProtected(editingFile.path)) {
      setError("Protected file cannot be modified.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/user/servers/${serverId}/files`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ path: editingFile.path, content: editingFile.content, action: "write" }),
      });
      if (res.ok) {
        setEditingFile(null);
        setSuccess(`Saved ${editingFile.path}`);
        setTimeout(() => setSuccess(""), 3000);
        loadFiles(currentPath);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to save file.");
      }
    } catch {
      setError("Failed to save file.");
    }
    setSaving(false);
  }

  async function handleCreate() {
    if (!newItemName.trim() || !canWriteHere) return;
    const targetPath = buildPath(newItemName.trim());
    try {
      const res = await fetch(`/api/user/servers/${serverId}/files`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ path: targetPath, content: "", action: "write" }),
      });
      if (res.ok) {
        setPromptingCreate(null);
        setNewItemName("");
        loadFiles(currentPath);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to create file.");
      }
    } catch {
      setError("Failed to create file.");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    if (!canWriteHere) {
      setError("Cannot upload to this directory. Directory is restricted.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const targetPath = buildPath(file.name);

        if (isProtected(targetPath)) {
          setError(`File "${file.name}" is protected and cannot be overwritten.`);
          continue;
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.split(",")[1] || "";
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`/api/user/servers/${serverId}/files`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            path: targetPath,
            action: "upload",
            base64Content: base64,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to upload ${file.name}`);
        }
      }

      setSuccess(`Uploaded ${fileList.length} file(s) successfully.`);
      setTimeout(() => setSuccess(""), 3000);
      loadFiles(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to upload file(s)");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExtractArchive(filename: string) {
    const fullPath = buildPath(filename);
    setExtracting(filename);
    setError("");

    try {
      const res = await fetch(`/api/user/servers/${serverId}/files`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          path: fullPath,
          action: "unzip",
          destination: currentPath,
        }),
      });

      if (res.ok) {
        setSuccess(`Extracted ${filename} successfully.`);
        setTimeout(() => setSuccess(""), 3000);
        loadFiles(currentPath);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to extract archive.");
      }
    } catch {
      setError("Failed to extract archive.");
    } finally {
      setExtracting(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const fullPath = buildPath(deleteTarget);
    if (isProtected(fullPath)) {
      setError(`"${deleteTarget}" is protected and cannot be deleted.`);
      setDeleteTarget(null);
      setDeleting(false);
      return;
    }

    try {
      const res = await fetch(`/api/user/servers/${serverId}/files?path=${encodeURIComponent(fullPath)}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        setDeleteTarget(null);
        loadFiles(currentPath);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to delete file.");
      }
    } catch {
      setError("Failed to delete file.");
    }
    setDeleting(false);
  }

  const pathParts = currentPath.split("/").filter(Boolean);

  if (editingFile) {
    const thisFileProtected = isProtected(editingFile.path);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setEditingFile(null)}
              className="btn-secondary-dark"
              style={{ padding: "5px 10px", fontSize: 12 }}
            >
              <ArrowLeft size={13} /> Back
            </button>
            <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "var(--text-pure)", fontWeight: 600 }}>
              {editingFile.path}
            </span>
          </div>

          {!thisFileProtected && (
            <button
              onClick={saveFile}
              disabled={saving}
              className="btn-solid-white"
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
              <span>Save Changes</span>
            </button>
          )}
        </div>

        <div className="saas-card" style={{ padding: 0, overflow: "hidden", height: "calc(100vh - 320px)", minHeight: 400 }}>
          <textarea
            value={editingFile.content}
            onChange={(e) => !thisFileProtected && setEditingFile({ ...editingFile, content: e.target.value })}
            readOnly={thisFileProtected}
            style={{
              width: "100%",
              height: "100%",
              background: "#000000",
              color: "#e4e4e7",
              padding: 16,
              fontFamily: "'SFMono-Regular', Consolas, Menlo, monospace",
              fontSize: 12.5,
              lineHeight: 1.6,
              outline: "none",
              border: "none",
              resize: "none",
            }}
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top Admin Bypass & Path Badges */}
      {isAdmin && (
        <div className="p-3 rounded-xl border flex items-center justify-between gap-3 animate-fade-in" style={{ backgroundColor: adminBypass ? "rgba(16,185,129,0.08)" : "var(--bg-surface)", borderColor: adminBypass ? "rgba(16,185,129,0.3)" : "var(--border-medium)" }}>
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck size={16} className={adminBypass ? "text-emerald-400" : "text-zinc-500"} />
            <div>
              <span className="font-bold text-white">Admin Elevated Access: </span>
              <span style={{ color: "var(--text-muted)" }}>
                {adminBypass ? "Bypass active — full access to root, system files, and server.jar." : "Bypass inactive — viewing through user perspective constraints."}
              </span>
            </div>
          </div>

          <button
            onClick={() => setAdminBypass(!adminBypass)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: adminBypass ? "#10b981" : "var(--bg-surface-elevated)",
              color: adminBypass ? "#000000" : "var(--text-secondary)",
              border: adminBypass ? "1px solid #10b981" : "1px solid var(--border-medium)",
            }}
          >
            {adminBypass ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>Bypass Enabled</span>
              </span>
            ) : (
              "Enable Admin Bypass"
            )}
          </button>
        </div>
      )}

      {/* Top Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {/* Breadcrumb path */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "4px 8px" }}>
          <button
            onClick={() => loadFiles("/")}
            style={{ background: "none", border: "none", color: currentPath === "/" ? "var(--text-pure)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}
          >
            <Home size={13} /> root
          </button>
          {pathParts.map((part, i) => {
            const path = "/" + pathParts.slice(0, i + 1).join("/");
            const isLast = i === pathParts.length - 1;
            return (
              <div key={path} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronRight size={12} style={{ color: "var(--text-dim)" }} />
                <button
                  onClick={() => !isLast && loadFiles(path)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: isLast ? "default" : "pointer",
                    color: isLast ? "var(--text-pure)" : "var(--text-muted)",
                    fontWeight: isLast ? 600 : 500,
                  }}
                >
                  {part}
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            style={{ display: "none" }}
          />

          {canWriteHere && (
            <>
              {canUploadHere && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary-dark"
                  style={{ padding: "5px 11px", fontSize: 12 }}
                  title="Upload files or .zip archives"
                >
                  {uploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
                  <span>{uploading ? "Uploading..." : "Upload"}</span>
                </button>
              )}

              <button
                onClick={() => setPromptingCreate("file")}
                className="btn-secondary-dark"
                style={{ padding: "5px 10px", fontSize: 12 }}
              >
                <FilePlus size={13} />
                <span>New File</span>
              </button>
              <button
                onClick={() => setPromptingCreate("folder")}
                className="btn-secondary-dark"
                style={{ padding: "5px 10px", fontSize: 12 }}
              >
                <FolderPlus size={13} />
                <span>New Folder</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Toasts */}
      {error && (
        <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#f87171", fontSize: 12.5 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 6, color: "#34d399", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={14} /> {success}
        </div>
      )}

      {/* Inline Create Form */}
      {promptingCreate && canWriteHere && (
        <div className="saas-card" style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            autoFocus
            placeholder={promptingCreate === "file" ? "e.g. config.yml" : "e.g. plugins"}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="saas-input"
            style={{ maxWidth: 280 }}
          />
          <button onClick={handleCreate} className="btn-solid-white" style={{ padding: "6px 12px", fontSize: 12 }}>
            Create
          </button>
          <button onClick={() => { setPromptingCreate(null); setNewItemName(""); }} className="btn-secondary-dark" style={{ padding: "6px 12px", fontSize: 12 }}>
            Cancel
          </button>
        </div>
      )}

      {/* Files Table */}
      <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-dim)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--bg-surface-elevated)" }}>
              <th style={{ padding: "10px 14px", width: 36 }}></th>
              <th style={{ padding: "10px 14px" }}>Name</th>
              <th style={{ padding: "10px 14px", width: 120 }}>Size</th>
              <th style={{ padding: "10px 14px", width: 160 }}>Modified</th>
              <th style={{ padding: "10px 14px", width: 110, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: "center" }}>
                  <Loader2 size={18} className="spin" style={{ margin: "0 auto", color: "var(--text-muted)" }} />
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>
                  Directory is empty.
                </td>
              </tr>
            ) : (
              files.map((f) => {
                const fullFilePath = buildPath(f.name);
                const fileProtected = isProtected(fullFilePath);
                const isZip = f.name.endsWith(".zip") || f.name.endsWith(".tar.gz");
                const isExtractingThis = extracting === f.name;

                return (
                  <tr
                    key={f.name}
                    style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      {fileProtected ? (
                        <Lock size={14} style={{ color: "#ef4444" }} />
                      ) : f.isDirectory ? (
                        <Folder size={14} style={{ color: "var(--text-secondary)" }} />
                      ) : isZip ? (
                        <Archive size={14} style={{ color: "#38bdf8" }} />
                      ) : (
                        <FileText size={14} style={{ color: "var(--text-muted)" }} />
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {f.isDirectory ? (
                        <button
                          onClick={() => loadFiles(fullFilePath)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontWeight: 500, fontSize: 13, textAlign: "left" }}
                          className="hover:underline"
                        >
                          {f.name}
                        </button>
                      ) : (
                        <button
                          onClick={() => openEditor(f.name)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", fontSize: 13, textAlign: "left" }}
                          className="hover:underline"
                        >
                          {f.name}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12, fontFamily: "monospace" }}>
                      {f.isDirectory ? "—" : formatBytes(f.size)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12 }}>
                      {new Date(f.modifiedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        {isZip && canWriteHere && (
                          <button
                            onClick={() => handleExtractArchive(f.name)}
                            disabled={isExtractingThis}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#38bdf8", padding: 4 }}
                            title="Extract archive"
                            className="hover:text-sky-300"
                          >
                            {isExtractingThis ? <Loader2 size={13} className="spin" /> : <Archive size={13} />}
                          </button>
                        )}
                        {!f.isDirectory && !fileProtected && (
                          <button
                            onClick={() => openEditor(f.name)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                            title="Edit"
                            className="hover:text-white"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {!fileProtected ? (
                          <button
                            onClick={() => setDeleteTarget(f.name)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                            title="Delete"
                            className="hover:text-red-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, padding: "2px 5px", background: "rgba(239,68,68,0.1)", borderRadius: 4 }}>
                            LOCKED
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete File"
        description={`Are you sure you want to delete "${deleteTarget}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
