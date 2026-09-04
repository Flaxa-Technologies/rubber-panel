"use client";

import { useState } from "react";
import { Play, Square, RotateCcw, Loader2, Zap } from "lucide-react";
import type { PowerAction } from "@/lib/types";

interface PowerControlsProps {
  serverId: string;
  status: string;
  suspended: boolean;
  onActionComplete?: () => void;
  onOptimisticStatus?: (newStatus: string) => void;
}

export default function PowerControls({ 
  serverId, 
  status, 
  suspended, 
  onActionComplete,
  onOptimisticStatus 
}: PowerControlsProps) {
  const [loading, setLoading] = useState<PowerAction | null>(null);

  const isSleeping = status === "SLEEPING";
  const isRunning = status === "RUNNING";
  const isStarting = status === "STARTING" || status === "WAKING";
  const isStopping = status === "STOPPING";
  const isOffline = status === "OFFLINE" || status === "STOPPED" || status === "CRASHED";

  async function handlePower(action: PowerAction) {
    if (loading) return;
    setLoading(action);

    if (action === "start") onOptimisticStatus?.(isSleeping ? "WAKING" : "STARTING");
    if (action === "restart") onOptimisticStatus?.("STARTING");
    if (action === "stop") onOptimisticStatus?.("STOPPING");

    try {
      await fetch(`/api/user/servers/${serverId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isSleeping && action === "start" ? "wake" : action }),
      });
      onActionComplete?.();
    } catch {
      alert("Failed to send power action to instance.");
    } finally {
      setLoading(null);
    }
  }

  if (suspended) {
    return (
      <span className="status-pill" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>
        Suspended
      </span>
    );
  }

  if (status === "TRANSFERRING") {
    return (
      <span className="status-pill" style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.4)", background: "rgba(56,189,248,0.12)", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px" }}>
        <Loader2 size={13} className="spin" style={{ color: "#38bdf8" }} />
        <span style={{ fontWeight: 600, fontSize: 12 }}>Migrating Node...</span>
      </span>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {/* Start / Wake Button */}
      <button 
        onClick={() => handlePower("start")} 
        disabled={loading !== null || isRunning || isStarting || isStopping} 
        className={isSleeping ? "btn-secondary-dark" : "btn-solid-white"}
        style={{ 
          opacity: (isRunning || isStarting || isStopping) ? 0.35 : 1,
          cursor: (isRunning || isStarting || isStopping) ? "not-allowed" : "pointer",
          backgroundColor: isSleeping ? "rgba(56, 189, 248, 0.15)" : undefined,
          color: isSleeping ? "#38bdf8" : undefined,
          borderColor: isSleeping ? "rgba(56, 189, 248, 0.4)" : undefined,
        }}
        title={isSleeping ? "Click to wake instance from Cryo-Sleep" : isRunning ? "Server is already running" : isStarting ? "Server is starting..." : "Start Instance"}
      >
        {loading === "start" || isStarting ? (
          <Loader2 size={13} className="spin" />
        ) : isSleeping ? (
          <Zap size={13} style={{ color: "#38bdf8" }} />
        ) : (
          <Play size={12} fill="currentColor" />
        )}
        <span>{isStarting ? (isSleeping ? "Waking..." : "Starting...") : isSleeping ? "Wake Server" : "Start"}</span>
      </button>

      {/* Restart Button */}
      <button 
        onClick={() => handlePower("restart")} 
        disabled={loading !== null || !isRunning || isStarting || isStopping} 
        className="btn-secondary-dark"
        style={{ 
          opacity: (!isRunning || isStarting || isStopping) ? 0.35 : 1,
          cursor: (!isRunning || isStarting || isStopping) ? "not-allowed" : "pointer" 
        }}
        title={!isRunning ? "Server must be running to restart" : "Restart Instance"}
      >
        {loading === "restart" ? (
          <Loader2 size={13} className="spin" />
        ) : (
          <RotateCcw size={12} />
        )}
        <span>Restart</span>
      </button>

      {/* Stop Button */}
      <button 
        onClick={() => handlePower("stop")} 
        disabled={loading !== null || (!isRunning && !isStarting) || isStopping} 
        className="btn-danger-dark"
        style={{ 
          opacity: (!isRunning && !isStarting) || isStopping ? 0.35 : 1,
          cursor: (!isRunning && !isStarting) || isStopping ? "not-allowed" : "pointer" 
        }}
        title={isOffline ? "Server is already stopped" : "Stop Instance"}
      >
        {loading === "stop" || isStopping ? (
          <Loader2 size={13} className="spin" />
        ) : (
          <Square size={12} fill="currentColor" />
        )}
        <span>{isStopping ? "Stopping..." : "Stop"}</span>
      </button>
    </div>
  );
}
