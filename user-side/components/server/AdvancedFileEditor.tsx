"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Save, ArrowLeft, Loader2, Sparkles, Search, Replace,
  Check, Copy, Maximize2, Minimize2, RotateCcw,
  FileCode, ShieldAlert, AlignLeft, ZoomIn, ZoomOut,
  ChevronDown, ChevronUp, X
} from "lucide-react";
import MinecraftRgbModal from "./MinecraftRgbModal";
import { copyToClipboard } from "@/lib/clipboard";

interface AdvancedFileEditorProps {
  filePath: string;
  initialContent: string;
  isProtected?: boolean;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function AdvancedFileEditor({
  filePath,
  initialContent,
  isProtected = false,
  onSave,
  onClose,
}: AdvancedFileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState<number>(13);
  const [showRgbModal, setShowRgbModal] = useState(false);

  // Find & Replace state
  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchWord, setMatchWord] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Cursor position
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  const isDirty = content !== savedContent;

  // Language detection
  const detectedLang = useMemo(() => {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const name = filePath.split("/").pop()?.toLowerCase() || "";
    if (name === "server.properties" || ext === "properties") return "Properties";
    if (ext === "yml" || ext === "yaml") return "YAML";
    if (ext === "json") return "JSON";
    if (ext === "toml") return "TOML";
    if (ext === "sh" || ext === "bash") return "Shell";
    if (ext === "js" || ext === "mjs" || ext === "cjs") return "JavaScript";
    if (ext === "ts") return "TypeScript";
    if (ext === "md" || ext === "markdown") return "Markdown";
    if (ext === "log") return "Log";
    if (ext === "env") return "Env";
    if (ext === "xml") return "XML";
    if (ext === "ini" || ext === "cfg") return "INI";
    if (ext === "py") return "Python";
    if (ext === "sql") return "SQL";
    return "Plain Text";
  }, [filePath]);

  // Line count
  const lines = useMemo(() => content.split("\n"), [content]);
  const lineCount = lines.length;

  // Sync scroll of line numbers gutter
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Update cursor position tracking
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value;
    const selStart = textareaRef.current.selectionStart;
    const textUpToCursor = text.substring(0, selStart);
    const lineNum = textUpToCursor.split("\n").length;
    const lastNewline = textUpToCursor.lastIndexOf("\n");
    const colNum = lastNewline === -1 ? selStart + 1 : selStart - lastNewline;
    setCursorPos({ line: lineNum, col: colNum });
  };

  // Find matches
  const matches = useMemo(() => {
    if (!findQuery) return [];
    const results: { start: number; end: number; line: number }[] = [];
    const flags = matchCase ? "g" : "gi";
    let pattern = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (matchWord) {
      pattern = `\\b${pattern}\\b`;
    }
    try {
      const regex = new RegExp(pattern, flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const textBefore = content.substring(0, match.index);
        const line = textBefore.split("\n").length;
        results.push({ start: match.index, end: match.index + match[0].length, line });
        if (regex.lastIndex === match.index) regex.lastIndex++;
      }
    } catch {
      // Invalid regex
    }
    return results;
  }, [content, findQuery, matchCase, matchWord]);

  // Select and scroll to current match
  const focusMatch = useCallback((index: number) => {
    if (!matches.length || !textareaRef.current) return;
    const target = matches[index % matches.length];
    if (!target) return;

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(target.start, target.end);

    // Scroll textarea to line
    const approxLineHeight = fontSize * 1.6;
    textareaRef.current.scrollTop = Math.max(0, (target.line - 5) * approxLineHeight);
    setCurrentMatchIndex(index % matches.length);
    updateCursorPosition();
  }, [matches, fontSize]);

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    focusMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    focusMatch(prevIdx);
  };

  const handleReplaceOne = () => {
    if (!matches.length || !textareaRef.current) return;
    const match = matches[currentMatchIndex];
    if (!match) return;

    const newContent = content.substring(0, match.start) + replaceQuery + content.substring(match.end);
    setContent(newContent);
    setTimeout(() => {
      focusMatch(currentMatchIndex);
    }, 50);
  };

  const handleReplaceAll = () => {
    if (!findQuery || !matches.length) return;
    const flags = matchCase ? "g" : "gi";
    let pattern = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (matchWord) pattern = `\\b${pattern}\\b`;
    try {
      const regex = new RegExp(pattern, flags);
      const newContent = content.replace(regex, replaceQuery);
      setContent(newContent);
    } catch {}
  };

  // Keyboard Shortcuts (Ctrl+S, Ctrl+F, Ctrl+H, Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl + S (Save)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!isProtected && !saving) {
        doSave();
      }
      return;
    }

    // Ctrl + F (Find)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setShowFind(true);
      setShowReplace(false);
      setTimeout(() => findInputRef.current?.focus(), 50);
      return;
    }

    // Ctrl + H (Find & Replace)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
      e.preventDefault();
      setShowFind(true);
      setShowReplace(true);
      setTimeout(() => findInputRef.current?.focus(), 50);
      return;
    }

    // Tab key indent
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;

      const newContent = val.substring(0, start) + "  " + val.substring(end);
      setContent(newContent);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
        updateCursorPosition();
      }, 0);
    }
  };

  // Global keydown for Escape
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showFind) {
          setShowFind(false);
          textareaRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [showFind]);

  const doSave = async () => {
    if (isProtected) return;
    setSaving(true);
    try {
      await onSave(content);
      setSavedContent(content);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAll = async () => {
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertGradient = (gradientText: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newContent = content.substring(0, start) + gradientText + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textareaRef.current?.focus();
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + gradientText.length;
      }
      updateCursorPosition();
    }, 50);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? 0 : "auto",
        zIndex: isFullscreen ? 999 : "auto",
        background: "#090a0d",
        border: isFullscreen ? "none" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: isFullscreen ? 0 : 12,
        boxShadow: isFullscreen ? "none" : "0 10px 30px rgba(0,0,0,0.5)",
        overflow: "hidden",
        height: isFullscreen ? "100vh" : "calc(100vh - 270px)",
        minHeight: 480,
      }}
    >
      {/* ── TOP HEADER TOOLBAR ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "linear-gradient(180deg, #16181f 0%, #101217 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Left: Back + File path + Unsaved Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            onClick={onClose}
            className="btn-secondary-dark"
            style={{ padding: "4px 9px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <FileCode size={15} style={{ color: "#38bdf8", flexShrink: 0 }} />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={filePath}
            >
              {filePath}
            </span>

            {isDirty && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(234,179,8,0.15)",
                  color: "#facc15",
                  border: "1px solid rgba(234,179,8,0.3)",
                }}
              >
                ● Unsaved
              </span>
            )}

            {isProtected && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(239,68,68,0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <ShieldAlert size={11} /> Read Only
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Minecraft RGB Gradient Button */}
          <button
            type="button"
            onClick={() => setShowRgbModal(true)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(163,230,53,0.15) 0%, rgba(56,189,248,0.15) 50%, rgba(236,72,153,0.15) 100%)",
              border: "1px solid rgba(163,230,53,0.4)",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 0 12px rgba(163,230,53,0.15)",
            }}
            className="hover:border-lime-400 hover:shadow-lime-500/20"
            title="Open Minecraft RGB Gradient Generator"
          >
            <Sparkles size={13} style={{ color: "#a3e635" }} />
            <span style={{ background: "linear-gradient(90deg, #a3e635, #38bdf8, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              RGB Gradient
            </span>
          </button>

          {/* Find & Replace Trigger */}
          <button
            type="button"
            onClick={() => {
              setShowFind(!showFind);
              if (!showFind) setTimeout(() => findInputRef.current?.focus(), 50);
            }}
            style={{
              padding: "5px 9px",
              borderRadius: 6,
              border: showFind ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
              background: showFind ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
              color: showFind ? "#38bdf8" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 11.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Find & Replace (Ctrl+F / Ctrl+H)"
          >
            <Search size={12} />
            <span>Find</span>
          </button>

          {/* Word Wrap Toggle */}
          <button
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            style={{
              padding: "5px 9px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: wordWrap ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
              color: wordWrap ? "#ffffff" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 11.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Toggle Word Wrap"
          >
            <AlignLeft size={12} />
            <span>{wordWrap ? "Wrap" : "No Wrap"}</span>
          </button>

          {/* Font Size Selector */}
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 4px" }}>
            <button
              type="button"
              onClick={() => setFontSize(Math.max(11, fontSize - 1))}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px" }}
              title="Decrease Font Size"
            >
              <ZoomOut size={11} />
            </button>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", padding: "0 4px", fontFamily: "monospace" }}>
              {fontSize}px
            </span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(18, fontSize + 1))}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px" }}
              title="Increase Font Size"
            >
              <ZoomIn size={11} />
            </button>
          </div>

          {/* Copy All */}
          <button
            type="button"
            onClick={handleCopyAll}
            style={{
              padding: "5px 9px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: copied ? "#10b981" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 11.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Copy All Content"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Revert Changes */}
          {isDirty && (
            <button
              type="button"
              onClick={() => setContent(savedContent)}
              style={{
                padding: "5px 9px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 11.5,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Revert to saved version"
            >
              <RotateCcw size={12} />
              <span>Revert</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Save Button */}
          {!isProtected && (
            <button
              type="button"
              onClick={doSave}
              disabled={saving || !isDirty}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: isDirty ? "#ffffff" : "rgba(255,255,255,0.1)",
                color: isDirty ? "#000000" : "var(--text-dim)",
                fontWeight: 700,
                fontSize: 12,
                cursor: isDirty && !saving ? "pointer" : "default",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
              <span>{saving ? "Saving..." : "Save (Ctrl+S)"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── FIND & REPLACE OVERLAY TOOLBAR ── */}
      {showFind && (
        <div
          style={{
            padding: "8px 14px",
            background: "#181a22",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Row 1: Find Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", minWidth: 240, flex: "1 1 240px" }}>
              <input
                ref={findInputRef}
                type="text"
                placeholder="Find in file... (Enter to jump next)"
                value={findQuery}
                onChange={e => {
                  setFindQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  }
                }}
                style={{
                  width: "100%",
                  padding: "5px 70px 5px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "var(--bg-input)",
                  color: "#ffffff",
                  fontSize: 12,
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 8,
                  fontSize: 10.5,
                  color: findQuery && matches.length === 0 ? "#f87171" : "var(--text-dim)",
                  fontFamily: "monospace",
                }}
              >
                {findQuery ? (matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : "No match") : ""}
              </span>
            </div>

            {/* Navigation buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={handlePrevMatch}
                disabled={matches.length === 0}
                style={{
                  padding: "4px 7px",
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: matches.length ? "#ffffff" : "var(--text-dim)",
                  cursor: matches.length ? "pointer" : "default",
                }}
                title="Previous Match (Shift+Enter)"
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                disabled={matches.length === 0}
                style={{
                  padding: "4px 7px",
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: matches.length ? "#ffffff" : "var(--text-dim)",
                  cursor: matches.length ? "pointer" : "default",
                }}
                title="Next Match (Enter)"
              >
                <ChevronDown size={13} />
              </button>
            </div>

            {/* Match Modifiers */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => setMatchCase(!matchCase)}
                style={{
                  padding: "3px 6px",
                  borderRadius: 4,
                  border: matchCase ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                  background: matchCase ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.04)",
                  color: matchCase ? "#38bdf8" : "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: 700,
                }}
                title="Match Case (Aa)"
              >
                Aa
              </button>
              <button
                type="button"
                onClick={() => setMatchWord(!matchWord)}
                style={{
                  padding: "3px 6px",
                  borderRadius: 4,
                  border: matchWord ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                  background: matchWord ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.04)",
                  color: matchWord ? "#38bdf8" : "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: 700,
                }}
                title="Match Whole Word (\b)"
              >
                \b
              </button>
            </div>

            {/* Replace Toggle */}
            <button
              type="button"
              onClick={() => setShowReplace(!showReplace)}
              style={{
                padding: "4px 8px",
                borderRadius: 5,
                border: "1px solid rgba(255,255,255,0.1)",
                background: showReplace ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Replace size={12} />
              <span>Replace Mode</span>
            </button>

            {/* Close Find */}
            <button
              type="button"
              onClick={() => setShowFind(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                marginLeft: "auto",
                padding: 4,
              }}
              className="hover:text-white"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          {/* Row 2: Replace Controls if enabled */}
          {showReplace && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={e => setReplaceQuery(e.target.value)}
                style={{
                  minWidth: 240,
                  flex: "1 1 240px",
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "var(--bg-input)",
                  color: "#ffffff",
                  fontSize: 12,
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                onClick={handleReplaceOne}
                disabled={matches.length === 0 || isProtected}
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.06)",
                  color: matches.length ? "#ffffff" : "var(--text-dim)",
                  cursor: matches.length ? "pointer" : "default",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={matches.length === 0 || isProtected}
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.06)",
                  color: matches.length ? "#ffffff" : "var(--text-dim)",
                  cursor: matches.length ? "pointer" : "default",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Replace All ({matches.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── EDITOR BODY (GUTTER + TEXTAREA) ── */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          background: "#060709",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          style={{
            width: Math.max(48, `${lineCount}`.length * 10 + 24),
            flexShrink: 0,
            background: "#090a0e",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: "12px 6px 12px 4px",
            userSelect: "none",
            textAlign: "right",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, Menlo, monospace",
            fontSize,
            lineHeight: 1.6,
            color: "#475569",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: lineCount }).map((_, idx) => {
            const lineNum = idx + 1;
            const isCurrent = cursorPos.line === lineNum;
            return (
              <div
                key={lineNum}
                style={{
                  color: isCurrent ? "#38bdf8" : "rgba(255,255,255,0.25)",
                  fontWeight: isCurrent ? 700 : 400,
                }}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Textarea Code Canvas */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              if (!isProtected) {
                setContent(e.target.value);
                updateCursorPosition();
              }
            }}
            onScroll={handleScroll}
            onClick={updateCursorPosition}
            onKeyUp={updateCursorPosition}
            onKeyDown={handleKeyDown}
            readOnly={isProtected}
            wrap={wordWrap ? "soft" : "off"}
            style={{
              width: "100%",
              height: "100%",
              background: "transparent",
              color: "#e2e8f0",
              padding: "12px 16px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, Menlo, monospace",
              fontSize,
              lineHeight: 1.6,
              outline: "none",
              border: "none",
              resize: "none",
              whiteSpace: wordWrap ? "pre-wrap" : "pre",
              wordBreak: wordWrap ? "break-word" : "normal",
              tabSize: 2,
              caretColor: "#38bdf8",
            }}
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 14px",
          background: "#0e1015",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>
            Ln <strong style={{ color: "#ffffff" }}>{cursorPos.line}</strong>, Col <strong style={{ color: "#ffffff" }}>{cursorPos.col}</strong>
          </span>
          <span>{lineCount} lines</span>
          <span>{content.length} chars</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span>Language: <strong style={{ color: "#38bdf8" }}>{detectedLang}</strong></span>
          <span>UTF-8</span>
          <span>LF</span>
          <span style={{ color: isProtected ? "#f87171" : "#10b981", fontWeight: 700 }}>
            {isProtected ? "LOCKED" : "WRITABLE"}
          </span>
        </div>
      </div>

      {/* ── MINECRAFT RGB GRADIENT MODAL ── */}
      <MinecraftRgbModal
        open={showRgbModal}
        onClose={() => setShowRgbModal(false)}
        onInsert={handleInsertGradient}
      />
    </div>
  );
}
