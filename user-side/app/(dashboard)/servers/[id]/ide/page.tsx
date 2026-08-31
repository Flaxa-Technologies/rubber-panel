"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useServer } from "@/components/server/ServerContext";
import { copyToClipboard } from "@/lib/clipboard";
import { getServerAddress } from "@/lib/server-utils";
import {
  Code2, ExternalLink, RefreshCw, Maximize2, Minimize2,
  Play, Loader2, Copy, Check, Lock, Clock, Laptop, Terminal
} from "lucide-react";

export default function CloudIdePage() {
  const { server, refreshServer } = useServer();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const isSandbox = Boolean(server?.isSandbox || server?.serverType === "CODESANDBOX");

  useEffect(() => {
    if (server && !isSandbox) {
      router.replace(`/servers/${id}/console`);
    }
  }, [server, isSandbox, id, router]);

  if (!server) return null;

  if (!isSandbox) {
    return null;
  }

  const isRunning = server.status === "RUNNING";
  const serverAddress = getServerAddress(server);
  const ideUrl = `http://${serverAddress}/?folder=/home/coder/project`;


  async function handleStartIde() {
    setStarting(true);
    try {
      await fetch(`/api/user/servers/${server?.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      // Poll until server is RUNNING (auto-stops spinner, max 30s)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await refreshServer();
        // refreshServer updates the `server` obj in context, but we check via the
        // layout polling (which runs every 2.5s and updates server.status)
        if (attempts >= 15) {
          clearInterval(poll);
          setStarting(false);
        }
      }, 2000);
    } catch {
      setStarting(false);
    }
  }

  const copyPassword = async () => {
    if (server.sandboxPassword) {
      await copyToClipboard(server.sandboxPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${isFullscreen ? "fixed inset-0 z-50 bg-black p-3" : ""}`}>
      {/* ── TOP TOOLBAR ── */}
      <div className="saas-card" style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(163, 230, 53, 0.12)",
            border: "1px solid rgba(163, 230, 53, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent-lime)",
          }}>
            <Code2 size={15} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-pure)" }}>
                Cloud VS Code IDE
              </span>
              <span style={{ fontSize: 11, fontFamily: "monospace", padding: "1px 6px", borderRadius: 4, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", color: "var(--text-muted)" }}>
                {server.sandboxRuntime || "fullstack"}
              </span>
            </div>
          </div>
        </div>

        {/* Time Limit & Password Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {Boolean(server.sandboxDailyHoursLimit && server.sandboxDailyHoursLimit > 0) && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              padding: "3px 8px",
              borderRadius: 6,
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              color: "#38bdf8",
              fontWeight: 600,
            }}>
              <Clock size={12} />
              <span>Limit: {server.sandboxDailyHoursLimit}h / day</span>
            </div>
          )}

          {server.sandboxPassword && (
            <button
              onClick={copyPassword}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11.5,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-medium)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              title="Click to copy Web IDE password"
            >
              <Lock size={11} />
              <span>Password: ••••••••</span>
              {copiedPassword ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isRunning && (
              <>
                <button
                  onClick={() => setIframeKey(k => k + 1)}
                  className="btn-secondary-dark"
                  style={{ padding: "5px 9px", fontSize: 12 }}
                  title="Reload IDE View"
                >
                  <RefreshCw size={12} />
                  <span>Reload</span>
                </button>

                <a
                  href={ideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-solid-white"
                  style={{ padding: "5px 10px", fontSize: 12 }}
                  title="Open in new browser tab"
                >
                  <ExternalLink size={12} />
                  <span>Open in Tab</span>
                </a>
              </>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="btn-secondary-dark"
              style={{ padding: "5px 9px", fontSize: 12 }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── IDE EMBED / OFFLINE STATE ── */}
      {isRunning ? (
        <div
          className="saas-card"
          style={{
            padding: 0,
            overflow: "hidden",
            borderRadius: 10,
            border: "1px solid var(--border-medium)",
            height: isFullscreen ? "calc(100vh - 80px)" : "calc(100vh - 240px)",
            minHeight: 580,
            backgroundColor: "#1e1e1e",
          }}
        >
          <iframe
            key={iframeKey}
            src={ideUrl}
            title={`${server.name} — Cloud IDE`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              backgroundColor: "#1e1e1e",
            }}
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      ) : (
        <div
          className="saas-card"
          style={{
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 16,
            minHeight: 480,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(163, 230, 53, 0.1)",
              border: "1px solid rgba(163, 230, 53, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-lime)",
            }}
          >
            <Laptop size={26} />
          </div>

          <div style={{ maxWidth: 420 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-pure)" }}>
              Code Sandbox is Offline
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              Your workspace files and extensions are safely preserved. Click below to boot your cloud VS Code IDE container.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            <span>RAM: {(server.ram / 1024).toFixed(1)} GB</span>
            <span>·</span>
            <span>CPU: {server.cpu}%</span>
            <span>·</span>
            <span>Stack: {server.sandboxRuntime || "Fullstack"}</span>
          </div>

          <button
            onClick={handleStartIde}
            disabled={starting || server.suspended}
            className="btn-solid-white"
            style={{
              padding: "10px 24px",
              fontSize: 13.5,
              fontWeight: 700,
              marginTop: 10,
              boxShadow: "0 0 25px rgba(163, 230, 53, 0.2)",
            }}
          >
            {starting ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
            <span>{starting ? "Booting IDE Container..." : "Start Cloud VS Code IDE"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
