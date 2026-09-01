"use client";

import { useState, useMemo } from "react";
import {
  Sparkles, Copy, Check, Plus, Minus, X, ArrowDownToLine, RefreshCw, Palette, ExternalLink
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

export type MinecraftColorFormat =
  | "nickname"
  | "chat"
  | "legacy"
  | "console"
  | "bbcode"
  | "minimessage"
  | "custom";

interface MinecraftRgbModalProps {
  open: boolean;
  onClose: () => void;
  onInsert?: (text: string) => void;
}

interface Preset {
  name: string;
  colors: string[];
}

const PRESETS: Preset[] = [
  { name: "MinecraftMenu", colors: ["#00aa00", "#55ff55"] },
  { name: "Rainbow", colors: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#8b00ff"] },
  { name: "Skyline", colors: ["#00c0ff", "#4218b8"] },
  { name: "Mango", colors: ["#ffe259", "#ffa751"] },
  { name: "Vice City", colors: ["#f107a3", "#7b2ff7"] },
  { name: "Dawn", colors: ["#f3904f", "#3b4371"] },
  { name: "Rose", colors: ["#f857a6", "#ff5858"] },
  { name: "Firewatch", colors: ["#cb2d3e", "#ef473a"] },
  { name: "Cyberpunk", colors: ["#00f0ff", "#ff003c"] },
  { name: "Neon Green", colors: ["#10b981", "#a3e635"] },
  { name: "Sunset Gold", colors: ["#ff512f", "#f09819"] },
  { name: "Ocean Wave", colors: ["#2b5876", "#4e4376"] },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map(c => c + c).join("");
  }
  const intVal = parseInt(cleaned, 16);
  if (isNaN(intVal) || cleaned.length !== 6) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map(x => x.toString(16).padStart(2, "0"))
      .join("")
  );
}

function interpolateColors(colors: string[], steps: number): string[] {
  if (steps <= 0) return [];
  if (steps === 1) return [colors[0]];
  if (colors.length === 1) return Array(steps).fill(colors[0]);

  const rgbColors = colors.map(hexToRgb);
  const result: string[] = [];
  const segments = colors.length - 1;

  for (let i = 0; i < steps; i++) {
    const globalProgress = i / (steps - 1);
    const segmentIndex = Math.min(Math.floor(globalProgress * segments), segments - 1);
    const segmentProgress = (globalProgress * segments) - segmentIndex;

    const start = rgbColors[segmentIndex];
    const end = rgbColors[segmentIndex + 1];

    const r = start.r + (end.r - start.r) * segmentProgress;
    const g = start.g + (end.g - start.g) * segmentProgress;
    const b = start.b + (end.b - start.b) * segmentProgress;

    result.push(rgbToHex(r, g, b));
  }

  return result;
}

export default function MinecraftRgbModal({ open, onClose, onInsert }: MinecraftRgbModalProps) {
  const [format, setFormat] = useState<MinecraftColorFormat>("nickname");
  const [colors, setColors] = useState<string[]>(["#00aa00", "#55ff55"]);
  const [prefix, setPrefix] = useState("");
  const [message, setMessage] = useState("Welcome to Rubber Panel!");
  const [customPattern, setCustomPattern] = useState("&#$c$f$m");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [strikethrough, setStrikethrough] = useState(false);
  const [copied, setCopied] = useState(false);

  const addColor = () => {
    if (colors.length < 6) {
      setColors([...colors, "#38bdf8"]);
    }
  };

  const removeColor = () => {
    if (colors.length > 2) {
      setColors(colors.slice(0, -1));
    }
  };

  const updateColor = (index: number, val: string) => {
    const next = [...colors];
    next[index] = val;
    setColors(next);
  };

  const applyPreset = (preset: Preset) => {
    setColors([...preset.colors]);
  };

  // Build legacy / format string
  const formatText = useMemo(() => {
    if (!message) return "";

    const chars = Array.from(message);
    const interpolated = interpolateColors(colors, chars.length);

    if (format === "minimessage") {
      let tags = "";
      if (bold) tags += "<b>";
      if (italic) tags += "<i>";
      if (underline) tags += "<u>";
      if (strikethrough) tags += "<s>";

      let closeTags = "";
      if (strikethrough) closeTags += "</s>";
      if (underline) closeTags += "</u>";
      if (italic) closeTags += "</i>";
      if (bold) closeTags += "</b>";

      const gradTag = `<gradient:${colors.map(c => c.toLowerCase()).join(":")}>`;
      const endGrad = `</gradient>`;

      return `${prefix}${gradTag}${tags}${message}${closeTags}${endGrad}`;
    }

    let output = prefix;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const hex = interpolated[i].replace("#", "").toLowerCase();

      let formatCodes = "";
      if (format === "console") {
        if (bold) formatCodes += "§l";
        if (italic) formatCodes += "§o";
        if (underline) formatCodes += "§n";
        if (strikethrough) formatCodes += "§m";
      } else if (format === "bbcode") {
        // BBCode wrapping
      } else {
        if (bold) formatCodes += "&l";
        if (italic) formatCodes += "&o";
        if (underline) formatCodes += "&n";
        if (strikethrough) formatCodes += "&m";
      }

      switch (format) {
        case "nickname":
          output += `&#${hex}${formatCodes}${char}`;
          break;
        case "chat":
          output += `<#${hex}>${formatCodes}${char}`;
          break;
        case "legacy": {
          const splitHex = hex.split("").map(c => `&${c}`).join("");
          output += `&x${splitHex}${formatCodes}${char}`;
          break;
        }
        case "console": {
          const splitHex = hex.split("").map(c => `§${c}`).join("");
          output += `§x${splitHex}${formatCodes}${char}`;
          break;
        }
        case "bbcode": {
          let inner = char;
          if (bold) inner = `[B]${inner}[/B]`;
          if (italic) inner = `[I]${inner}[/I]`;
          if (underline) inner = `[U]${inner}[/U]`;
          if (strikethrough) inner = `[S]${inner}[/S]`;
          output += `[COLOR=#${hex}]${inner}[/COLOR]`;
          break;
        }
        case "custom": {
          // Replace $c with hex, $f with formatCodes, $m with char
          const pattern = customPattern
            .replace(/\$c/g, hex)
            .replace(/\$f/g, formatCodes)
            .replace(/\$m/g, char);
          output += pattern;
          break;
        }
      }
    }

    return output;
  }, [message, colors, format, prefix, bold, italic, underline, strikethrough, customPattern]);

  const handleCopy = async () => {
    if (!formatText) return;
    await copyToClipboard(formatText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (onInsert && formatText) {
      onInsert(formatText);
      onClose();
    }
  };

  // Linear gradient CSS for preview
  const gradientCss = useMemo(() => {
    return `linear-gradient(90deg, ${colors.join(", ")})`;
  }, [colors]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "#0d0e12",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.9), 0 0 40px rgba(163,230,53,0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg, #a3e635 0%, #38bdf8 50%, #ec4899 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#000000",
                boxShadow: "0 0 15px rgba(163,230,53,0.3)",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}>
                Minecraft RGB Gradient Generator
              </h2>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                Craft rich HEX gradients for Essentials, CMI, MOTD, Chat, &amp; MiniMessage · Credit: Oli &amp; Saboor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
            }}
            className="hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Live Visual Gradient Preview */}
          <div
            style={{
              padding: "16px 20px",
              background: "radial-gradient(ellipse at top, #181b22 0%, #090a0d 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 700 }}>
              Live Visual Preview
            </span>
            <div
              style={{
                marginTop: 8,
                fontSize: 20,
                fontWeight: bold ? 800 : 600,
                fontStyle: italic ? "italic" : "normal",
                textDecoration: `${underline ? "underline" : ""} ${strikethrough ? "line-through" : ""}`.trim() || "none",
                background: gradientCss,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "'Minecraft', 'Inter', monospace, sans-serif",
                letterSpacing: "0.02em",
                wordBreak: "break-word",
                minHeight: 28,
              }}
            >
              {message || "Type your message..."}
            </div>
          </div>

          {/* Color Format Selector */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Color Format
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
              {[
                { id: "nickname", label: "Nickname", example: "&#rrggbb" },
                { id: "chat", label: "Chat", example: "<#rrggbb>" },
                { id: "legacy", label: "Legacy", example: "&x&r&r&g&g&b&b" },
                { id: "console", label: "Console", example: "§x§r§r§g§g§b§b" },
                { id: "bbcode", label: "BBCode", example: "[COLOR=#...]" },
                { id: "minimessage", label: "MiniMessage", example: "<gradient>" },
                { id: "custom", label: "Custom", example: "$c $f $m" },
              ].map(opt => {
                const active = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id as MinecraftColorFormat)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: active ? "1px solid #a3e635" : "1px solid rgba(255,255,255,0.08)",
                      background: active ? "rgba(163,230,53,0.12)" : "rgba(255,255,255,0.03)",
                      color: active ? "#a3e635" : "var(--text-secondary)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: active ? "#a3e635" : "var(--text-dim)", fontFamily: "monospace", marginTop: 2 }}>
                      {opt.example}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom pattern input if selected */}
          {format === "custom" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
                Custom Pattern ($c = hex, $f = formatting, $m = character):
              </label>
              <input
                type="text"
                value={customPattern}
                onChange={e => setCustomPattern(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-medium)",
                  background: "var(--bg-input)",
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Color Presets */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
                <Palette size={13} style={{ color: "#38bdf8" }} /> Color Presets
              </label>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  className="hover:border-lime-400 hover:text-white"
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${preset.colors.join(", ")})`,
                      display: "inline-block",
                    }}
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Stops & Stepper */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Color Stops ({colors.length}/6)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={removeColor}
                  disabled={colors.length <= 2}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: colors.length <= 2 ? "var(--text-dim)" : "var(--text-secondary)",
                    cursor: colors.length <= 2 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 11,
                  }}
                >
                  <Minus size={12} /> Remove
                </button>
                <button
                  type="button"
                  onClick={addColor}
                  disabled={colors.length >= 6}
                  style={{
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)",
                    color: colors.length >= 6 ? "var(--text-dim)" : "var(--text-secondary)",
                    cursor: colors.length >= 6 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 11,
                  }}
                >
                  <Plus size={12} /> Add Color
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${colors.length}, 1fr)`, gap: 8 }}>
              {colors.map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <input
                    type="color"
                    value={c}
                    onChange={e => updateColor(idx, e.target.value)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      background: "transparent",
                      padding: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={c}
                    onChange={e => updateColor(idx, e.target.value)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "#ffffff",
                      fontSize: 11,
                      fontFamily: "monospace",
                      outline: "none",
                      textTransform: "uppercase",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Style Modifiers (Bold, Italic, Underline, Strikethrough) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Formatting Styles
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Bold", key: "bold", state: bold, set: setBold },
                { label: "Italic", key: "italic", state: italic, set: setItalic },
                { label: "Underline", key: "underline", state: underline, set: setUnderline },
                { label: "Strikethrough", key: "strikethrough", state: strikethrough, set: setStrikethrough },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => item.set(!item.state)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: item.state ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                    background: item.state ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                    color: item.state ? "#38bdf8" : "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs: Prefix & Message */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                Prefix (e.g. /nick)
              </label>
              <input
                type="text"
                placeholder="/broadcast "
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-medium)",
                  background: "var(--bg-input)",
                  color: "#ffffff",
                  fontSize: 12.5,
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                Message Text
              </label>
              <input
                type="text"
                placeholder="Enter text..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border-medium)",
                  background: "var(--bg-input)",
                  color: "#ffffff",
                  fontSize: 12.5,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Output Box */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                Formatted Output
              </label>
              <span style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
                {formatText.length} characters
              </span>
            </div>
            <textarea
              readOnly
              rows={3}
              value={formatText}
              onClick={handleCopy}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#050608",
                color: "#a3e635",
                fontFamily: "monospace",
                fontSize: 12,
                outline: "none",
                resize: "none",
                cursor: "pointer",
              }}
              title="Click to copy"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0,0,0,0.4)",
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-dim)" }}>
            <span>Powered by Rubber Panel RGB Engine</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary-dark"
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              {copied ? <Check size={13} style={{ color: "#10b981" }} /> : <Copy size={13} />}
              <span>{copied ? "Copied!" : "Copy Output"}</span>
            </button>

            {onInsert && (
              <button
                type="button"
                onClick={handleInsert}
                className="btn-solid-white"
                style={{ padding: "6px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              >
                <ArrowDownToLine size={13} />
                <span>Insert Into Editor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
