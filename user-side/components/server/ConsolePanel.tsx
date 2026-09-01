"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Trash2, Terminal as TerminalIcon, Play,
  ArrowDownToLine, Copy, Check, Users, Shield, ShieldAlert,
  UserX, UserCheck, MessageSquare, Plus, Search, ChevronLeft,
  ChevronRight, Sparkles, SlidersHorizontal, X, Maximize2, Minimize2
} from "lucide-react";
import Image from "next/image";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { copyToClipboard } from "@/lib/clipboard";

interface ConsolePanelProps {
  serverId: string;
  status: string;
}

interface LogLine {
  text: string;
  type: "system" | "input" | "error" | "warn" | "info" | "chat";
}

interface OnlinePlayer {
  name: string;
  isOp: boolean;
  online: boolean;
}

interface BannedPlayer {
  name: string;
  reason: string;
  created: string;
  source: string;
}

interface WhitelistPlayer {
  name: string;
  uuid: string;
}

interface OpPlayer {
  name: string;
  level: number;
}

function classifyLine(text: string): LogLine["type"] {
  if (typeof text !== "string") text = String(text || "");
  const l = text.toLowerCase();
  if (l.includes("[error]") || l.includes("exception") || l.includes("fatal") || l.includes("crashed")) return "error";
  if (l.includes("[warn]") || l.includes("warning")) return "warn";
  if (l.startsWith(">")) return "input";
  if (l.includes("<") && l.includes(">")) return "chat";
  if (l.includes("[info]") || l.includes("[panel]") || l.includes("done (")) return "info";
  return "system";
}

function getLineColor(type: LogLine["type"]) {
  switch (type) {
    case "error": return "#f87171";
    case "warn": return "#fbbf24";
    case "input": return "#ffffff";
    case "info": return "#34d399";
    case "chat": return "#38bdf8";
    default: return "#a1a1aa";
  }
}

export default function ConsolePanel({ serverId, status }: ConsolePanelProps) {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [sending, setSending] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Command History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Player Management State
  const [playerTab, setPlayerTab] = useState<"online" | "banned" | "whitelist" | "ops">("online");
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayer[]>([]);
  const [whitelistPlayers, setWhitelistPlayers] = useState<WhitelistPlayer[]>([]);
  const [opsPlayers, setOpsPlayers] = useState<OpPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerPage, setPlayerPage] = useState(1);
  const PLAYERS_PER_PAGE = 10;

  // Action Dialog State
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "kick" | "ban" | "unban" | "op" | "deop" | "whitelist_add" | "whitelist_remove" | "msg";
    player: string;
    reason?: string;
  }>({ open: false, type: "kick", player: "", reason: "" });
  const [executingAction, setExecutingAction] = useState(false);

  // Add Whitelist / Add Ban input
  const [inputUsername, setInputUsername] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRunning = status === "RUNNING" || status === "STARTING";

  const scrollToBottom = useCallback(() => {
    if (outputRef.current && autoScroll) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [autoScroll]);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    function handleKeyDownEvent(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDownEvent);
    return () => window.removeEventListener("keydown", handleKeyDownEvent);
  }, [isFullscreen]);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/servers/${serverId}/console?since=${lineCount}`);
      if (!res.ok) return;
      const data = await res.json() as { lines: string[]; total: number };
      if (data.lines?.length > 0) {
        const newLines: LogLine[] = data.lines.map(text => ({ text, type: classifyLine(text) }));
        setLines(prev => [...prev, ...newLines].slice(-1000));
        setLineCount(data.total ?? 0);
      }
    } catch { }
  }, [serverId, lineCount]);

  // Fetch Players
  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/servers/${serverId}/players`);
      if (res.ok) {
        const data = await res.json();
        setOnlinePlayers(data.online || []);
        setBannedPlayers(data.banned || []);
        setWhitelistPlayers(data.whitelist || []);
        setOpsPlayers(data.ops || []);
      }
    } catch {}
  }, [serverId]);

  useEffect(() => {
    fetchLogs();
    const logInterval = setInterval(fetchLogs, isRunning ? 1500 : 5000);
    return () => clearInterval(logInterval);
  }, [serverId, isRunning, fetchLogs]);

  useEffect(() => {
    fetchPlayers();
    const playerInterval = setInterval(fetchPlayers, 6000);
    return () => clearInterval(playerInterval);
  }, [serverId, fetchPlayers]);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  async function handleSend(e?: React.FormEvent, cmdToSend?: string) {
    if (e) e.preventDefault();
    const cmd = (cmdToSend ?? command).trim();
    if (!cmd) return;

    setSending(true);
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setCommand("");

    try {
      await fetch(`/api/user/servers/${serverId}/console`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
    } catch {
      setLines(prev => [...prev, { text: "[Error] Failed to send command to daemon.", type: "error" }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(i);
      setCommand(history[i] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = Math.max(historyIndex - 1, -1);
      setHistoryIndex(i);
      setCommand(i === -1 ? "" : history[i] ?? "");
    }
  }

  async function handleCopyLogs() {
    const text = lines.map(l => l.text).join("\n");
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function executePlayerAction() {
    if (!actionDialog.player) return;
    setExecutingAction(true);

    try {
      const res = await fetch(`/api/user/servers/${serverId}/players/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionDialog.type,
          player: actionDialog.player,
          reason: actionDialog.reason,
        }),
      });

      if (res.ok) {
        setActionSuccess(`Successfully executed ${actionDialog.type} on ${actionDialog.player}`);
        setTimeout(() => setActionSuccess(""), 4000);
        setActionDialog({ open: false, type: "kick", player: "", reason: "" });
        fetchPlayers();
      }
    } catch {}
    setExecutingAction(false);
  }

  async function handleDirectPlayerAction(action: string, player: string) {
    try {
      const res = await fetch(`/api/user/servers/${serverId}/players/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, player }),
      });
      if (res.ok) {
        setActionSuccess(`Executed ${action} for ${player}`);
        setTimeout(() => setActionSuccess(""), 3500);
        fetchPlayers();
      }
    } catch {}
  }

  // Quick Action Buttons
  const quickActions = [
    { label: "save-all", cmd: "save-all" },
    { label: "tps", cmd: "tps" },
    { label: "list", cmd: "list" },
    { label: "reload confirm", cmd: "reload confirm" },
  ];

  // Filtered Players for Active Tab
  let activeList: any[] = [];
  if (playerTab === "online") activeList = Array.isArray(onlinePlayers) ? onlinePlayers : [];
  else if (playerTab === "banned") activeList = Array.isArray(bannedPlayers) ? bannedPlayers : [];
  else if (playerTab === "whitelist") activeList = Array.isArray(whitelistPlayers) ? whitelistPlayers : [];
  else if (playerTab === "ops") activeList = Array.isArray(opsPlayers) ? opsPlayers : [];

  const filteredList = (activeList || []).filter(p =>
    p && (p.name || "").toLowerCase().includes((playerSearch || "").toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PLAYERS_PER_PAGE));
  const paginatedList = filteredList.slice((playerPage - 1) * PLAYERS_PER_PAGE, playerPage * PLAYERS_PER_PAGE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Terminal Console Card */}
      <div
        className="saas-card"
        style={
          isFullscreen
            ? {
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                width: "100vw",
                height: "100vh",
                borderRadius: 0,
                margin: 0,
                padding: 0,
                background: "#050608",
                display: "flex",
                flexDirection: "column",
                border: "none",
                boxShadow: "none",
              }
            : { padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
        }
      >
        {/* Top Console Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            background: isFullscreen ? "#0a0c10" : "var(--bg-surface-elevated)",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            <TerminalIcon size={14} style={{ color: isRunning ? "var(--status-online)" : "var(--text-dim)" }} />
            <span style={{ color: "var(--text-pure)", fontWeight: 600 }}>
              {isFullscreen ? "Full Screen Shell Terminal" : "Live Server Terminal"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              ({lines.length} buffer lines)
            </span>
            {isFullscreen && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                Press <kbd style={{ color: "#fff", fontWeight: "bold" }}>Esc</kbd> to exit
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Fullscreen Toggle */}
            <button
              onClick={() => {
                const nextState = !isFullscreen;
                setIsFullscreen(nextState);
                setTimeout(() => {
                  inputRef.current?.focus();
                  scrollToBottom();
                }, 50);
              }}
              className="btn-secondary-dark"
              style={{ padding: "4px 8px", fontSize: 11.5, borderColor: isFullscreen ? "var(--status-online)" : undefined }}
              title={isFullscreen ? "Exit Fullscreen (Esc)" : "Full Screen Console"}
            >
              {isFullscreen ? <Minimize2 size={12} style={{ color: "var(--status-online)" }} /> : <Maximize2 size={12} />}
              <span>{isFullscreen ? "Exit Shell" : "Fullscreen"}</span>
            </button>

            {/* Auto-scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="btn-secondary-dark"
              style={{ padding: "4px 8px", fontSize: 11.5 }}
              title="Toggle Auto Scroll"
            >
              <ArrowDownToLine size={12} style={{ color: autoScroll ? "var(--status-online)" : "var(--text-dim)" }} />
              <span>{autoScroll ? "Scroll: ON" : "Scroll: OFF"}</span>
            </button>

            {/* Copy Logs */}
            <button
              onClick={handleCopyLogs}
              className="btn-secondary-dark"
              style={{ padding: "4px 8px", fontSize: 11.5 }}
              title="Copy all logs to clipboard"
            >
              {copied ? <Check size={12} style={{ color: "var(--status-online)" }} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            {/* Clear Logs */}
            <button
              onClick={() => setLines([])}
              className="btn-secondary-dark"
              style={{ padding: "4px 8px", fontSize: 11.5 }}
              title="Clear terminal window"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Quick Command Shortcuts */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", overflowX: "auto" }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600, flexShrink: 0 }}>
            Shortcuts:
          </span>
          {quickActions.map((qa) => (
            <button
              key={qa.cmd}
              onClick={() => handleSend(undefined, qa.cmd)}
              disabled={!isRunning || sending}
              style={{
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                fontSize: 11,
                fontFamily: "monospace",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.1s",
              }}
              className="hover:text-white hover:border-zinc-700"
            >
              /{qa.label}
            </button>
          ))}
        </div>

        {/* Terminal Log Output Window */}
        <div
          ref={outputRef}
          style={{
            flex: isFullscreen ? 1 : "unset",
            height: isFullscreen ? "100%" : 380,
            minHeight: isFullscreen ? 0 : 380,
            overflowY: "auto",
            padding: "14px 16px",
            background: "#050608",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: isFullscreen ? 13.5 : 12.5,
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            userSelect: "text",
          }}
        >
          {lines.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontStyle: "italic", padding: "16px 0" }}>
              Terminal connected. Waiting for server log stream...
            </div>
          ) : (
            lines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  color: getLineColor(line.type),
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                }}
              >
                {line.text}
              </div>
            ))
          )}
        </div>

        {/* Command Input Form */}
        <form
          onSubmit={(e) => handleSend(e)}
          style={{
            display: "flex",
            alignItems: "center",
            padding: isFullscreen ? "12px 18px" : "8px 12px",
            background: isFullscreen ? "#0a0c10" : "var(--bg-surface-elevated)",
            borderTop: "1px solid var(--border-subtle)",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 13, paddingLeft: 4 }}>
            &gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder={isRunning ? "Type a console command and press Enter..." : "Server is offline. Start the server to send commands."}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isRunning || sending}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "monospace",
              fontSize: isFullscreen ? 14 : 13,
            }}
          />
          <button
            type="submit"
            disabled={!isRunning || sending || !command.trim()}
            className="btn-solid-white"
            style={{ padding: isFullscreen ? "7px 16px" : "5px 12px", fontSize: 12 }}
          >
            {sending ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* 2. Live Player & Security Management Section */}
      <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header & Tabs */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} style={{ color: "var(--text-pure)" }} />
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)" }}>
              Player &amp; Access Management
            </h3>
          </div>

          {/* Sub-Tabs */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-surface)", padding: 3, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => { setPlayerTab("online"); setPlayerPage(1); }}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: playerTab === "online" ? "#ffffff" : "transparent",
                color: playerTab === "online" ? "#000000" : "var(--text-muted)",
                fontWeight: playerTab === "online" ? 700 : 500,
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              Online ({onlinePlayers.length})
            </button>
            <button
              onClick={() => { setPlayerTab("whitelist"); setPlayerPage(1); }}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: playerTab === "whitelist" ? "#ffffff" : "transparent",
                color: playerTab === "whitelist" ? "#000000" : "var(--text-muted)",
                fontWeight: playerTab === "whitelist" ? 700 : 500,
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              Whitelist ({whitelistPlayers.length})
            </button>
            <button
              onClick={() => { setPlayerTab("banned"); setPlayerPage(1); }}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: playerTab === "banned" ? "#ffffff" : "transparent",
                color: playerTab === "banned" ? "#000000" : "var(--text-muted)",
                fontWeight: playerTab === "banned" ? 700 : 500,
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              Banned ({bannedPlayers.length})
            </button>
            <button
              onClick={() => { setPlayerTab("ops"); setPlayerPage(1); }}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: playerTab === "ops" ? "#ffffff" : "transparent",
                color: playerTab === "ops" ? "#000000" : "var(--text-muted)",
                fontWeight: playerTab === "ops" ? 700 : 500,
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              Ops ({opsPlayers.length})
            </button>
          </div>
        </div>

        {/* Action success alert */}
        {actionSuccess && (
          <div style={{ padding: "8px 16px", background: "rgba(16,185,129,0.1)", borderBottom: "1px solid rgba(16,185,129,0.2)", color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Filter and Quick Add Row */}
        <div style={{ padding: "10px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {/* Search */}
          <div style={{ position: "relative", width: 220 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input
              type="text"
              placeholder="Search player username..."
              value={playerSearch}
              onChange={(e) => { setPlayerSearch(e.target.value); setPlayerPage(1); }}
              className="saas-input"
              style={{ paddingLeft: 30, paddingRight: 8, height: 32, fontSize: 12 }}
            />
          </div>

          {/* Quick Action Input (Add to Whitelist or Ban by username) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="text"
              placeholder="Username..."
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              className="saas-input"
              style={{ width: 140, height: 32, fontSize: 12 }}
            />
            {playerTab === "whitelist" ? (
              <button
                onClick={() => {
                  if (inputUsername.trim()) {
                    handleDirectPlayerAction("whitelist_add", inputUsername.trim());
                    setInputUsername("");
                  }
                }}
                className="btn-solid-white"
                style={{ padding: "5px 10px", fontSize: 11.5, height: 32 }}
              >
                <Plus size={12} /> Add Whitelist
              </button>
            ) : (
              <button
                onClick={() => {
                  if (inputUsername.trim()) {
                    setActionDialog({ open: true, type: "ban", player: inputUsername.trim(), reason: "Banned by admin" });
                    setInputUsername("");
                  }
                }}
                className="btn-danger-dark"
                style={{ padding: "5px 10px", fontSize: 11.5, height: 32 }}
              >
                <UserX size={12} /> Ban Player
              </button>
            )}
          </div>
        </div>

        {/* Players List Table / Rows */}
        <div style={{ minHeight: 120 }}>
          {paginatedList.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
              {playerSearch ? "No players match your search." : playerTab === "online" ? "No players currently online on this server." : `No entries in ${playerTab} list.`}
            </div>
          ) : (
            paginatedList.map((p, idx) => (
              <div
                key={p.name + idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Player Avatar & Details */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-medium)",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src={`https://mc-heads.net/avatar/${p.name}/28`}
                      alt={p.name}
                      fill
                      sizes="28px"
                      unoptimized
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-pure)" }}>
                        {p.name}
                      </span>
                      {p.isOp && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>
                          OP
                        </span>
                      )}
                      {playerTab === "online" && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-online)" }} />
                      )}
                    </div>
                    {p.reason && (
                      <span style={{ fontSize: 11, color: "var(--text-dim)", display: "block" }}>
                        Reason: {p.reason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Player Quick Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {playerTab === "online" && (
                    <>
                      <button
                        onClick={() => setActionDialog({ open: true, type: "kick", player: p.name, reason: "Kicked by staff" })}
                        className="btn-secondary-dark"
                        style={{ padding: "4px 8px", fontSize: 11.5 }}
                        title="Kick from server"
                      >
                        Kick
                      </button>
                      <button
                        onClick={() => setActionDialog({ open: true, type: "ban", player: p.name, reason: "Banned by staff" })}
                        className="btn-secondary-dark"
                        style={{ padding: "4px 8px", fontSize: 11.5, color: "#f87171" }}
                        title="Ban from server"
                      >
                        Ban
                      </button>
                      <button
                        onClick={() => handleDirectPlayerAction(p.isOp ? "deop" : "op", p.name)}
                        className="btn-secondary-dark"
                        style={{ padding: "4px 8px", fontSize: 11.5 }}
                        title={p.isOp ? "Revoke OP" : "Make Server Operator"}
                      >
                        {p.isOp ? "De-OP" : "OP"}
                      </button>
                    </>
                  )}

                  {playerTab === "banned" && (
                    <button
                      onClick={() => handleDirectPlayerAction("unban", p.name)}
                      className="btn-solid-white"
                      style={{ padding: "4px 10px", fontSize: 11.5 }}
                    >
                      <UserCheck size={12} />
                      <span>Pardon / Unban</span>
                    </button>
                  )}

                  {playerTab === "whitelist" && (
                    <button
                      onClick={() => handleDirectPlayerAction("whitelist_remove", p.name)}
                      className="btn-secondary-dark"
                      style={{ padding: "4px 8px", fontSize: 11.5, color: "#f87171" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}

                  {playerTab === "ops" && (
                    <button
                      onClick={() => handleDirectPlayerAction("deop", p.name)}
                      className="btn-secondary-dark"
                      style={{ padding: "4px 8px", fontSize: 11.5, color: "#f87171" }}
                    >
                      Revoke OP
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer (Shows max 10 players per page) */}
        {filteredList.length > PLAYERS_PER_PAGE && (
          <div style={{ padding: "8px 16px", background: "var(--bg-surface-elevated)", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
            <span>
              Showing {(playerPage - 1) * PLAYERS_PER_PAGE + 1} - {Math.min(playerPage * PLAYERS_PER_PAGE, filteredList.length)} of {filteredList.length} players
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setPlayerPage(prev => Math.max(1, prev - 1))}
                disabled={playerPage === 1}
                className="btn-secondary-dark"
                style={{ padding: "3px 8px" }}
              >
                <ChevronLeft size={13} />
              </button>
              <span>Page {playerPage} of {totalPages}</span>
              <button
                onClick={() => setPlayerPage(prev => Math.min(totalPages, prev + 1))}
                disabled={playerPage === totalPages}
                className="btn-secondary-dark"
                style={{ padding: "3px 8px" }}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Dialog (Kick / Ban reason modal) */}
      {actionDialog.open && (
        <div className="saas-modal-backdrop">
          <div className="saas-modal-box" style={{ maxWidth: 440, background: "var(--bg-surface)", border: "1px solid var(--border-medium)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface-elevated)" }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-pure)", textTransform: "capitalize" }}>
                {actionDialog.type} Player &quot;{actionDialog.player}&quot;
              </h3>
              <button
                onClick={() => setActionDialog({ open: false, type: "kick", player: "" })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Reason
              </label>
              <input
                type="text"
                placeholder="Enter reason..."
                value={actionDialog.reason || ""}
                onChange={(e) => setActionDialog(prev => ({ ...prev, reason: e.target.value }))}
                className="saas-input"
              />
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setActionDialog({ open: false, type: "kick", player: "" })}
                className="btn-secondary-dark"
                style={{ padding: "6px 14px" }}
              >
                Cancel
              </button>
              <button
                onClick={executePlayerAction}
                disabled={executingAction}
                className={actionDialog.type === "ban" ? "btn-danger-dark" : "btn-solid-white"}
                style={{ padding: "6px 16px" }}
              >
                {executingAction ? <Loader2 size={12} className="spin" /> : null}
                <span>Confirm {actionDialog.type}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
