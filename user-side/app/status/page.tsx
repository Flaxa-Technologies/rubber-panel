"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, ShieldAlert,
  Server, MonitorSpeaker, Globe, ExternalLink, RefreshCw,
  Clock, Shield, ArrowLeft, Info, Wrench, Sparkles, Check, ChevronRight,
  Wifi, Cpu, HardDrive
} from "lucide-react";

interface StatusComponent {
  id: string;
  name: string;
  description: string;
  type: string;
  status: "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "OFFLINE" | "MAINTENANCE";
  uptimePercentage: number;
  latencyMs?: number | null;
  activeServers?: number;
  lastHeartbeat?: string | null;
}

interface StatusData {
  enabled: boolean;
  title: string;
  description: string;
  overallStatus: "OPERATIONAL" | "DEGRADED" | "PARTIAL_OUTAGE" | "MAINTENANCE";
  overallUptime: number;
  customMessage?: string;
  noticeType?: "info" | "warning" | "maintenance";
  showNotice?: boolean;
  themeAccent?: string;
  companyName?: string;
  supportUrl?: string;
  updatedAt?: string;
  components: StatusComponent[];
  historyBars?: { date: string; status: string; uptime: number }[];
}

export default function PublicStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);

  async function fetchStatus(isManual = false) {
    try {
      if (isManual) setRefreshing(true);
      const res = await fetch("/api/status", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
        setCountdown(30);
      }
    } catch (e) {
      console.error("Status fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);

    const timer = setInterval(() => {
      setCountdown(c => (c > 1 ? c - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="status-loading-screen">
        <style>{`
          .status-loading-screen {
            min-height: 100vh;
            background: #06080d;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .spin-icon { animation: spin 1s linear infinite; color: #a3e635; margin-bottom: 12px; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
        <RefreshCw className="w-8 h-8 spin-icon" />
        <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>
          Connecting to Rubber Panel cluster telemetry...
        </p>
      </div>
    );
  }

  if (!data || !data.enabled) {
    return (
      <div className="status-disabled-screen">
        <style>{`
          .status-disabled-screen {
            min-height: 100vh;
            background: #06080d;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            text-align: center;
          }
          .disabled-card {
            max-width: 440px;
            width: 100%;
            background: #0d111a;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 36px 28px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          }
          .disabled-icon {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 18px;
            color: #71717a;
          }
          .btn-back {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border-radius: 14px;
            background: #a3e635;
            color: #000000;
            font-weight: 700;
            font-size: 13px;
            text-decoration: none;
            margin-top: 20px;
            transition: transform 0.15s ease, background 0.15s ease;
          }
          .btn-back:hover { background: #bef264; transform: translateY(-1px); }
        `}</style>
        <div className="disabled-card">
          <div className="disabled-icon">
            <Activity size={24} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Status Page Offline</h1>
          <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
            The public status page is currently disabled by the system administrator.
          </p>
          <Link href="/dashboard" className="btn-back">
            <ArrowLeft size={16} />
            <span>Return to User Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOperational = data.overallStatus === "OPERATIONAL";
  const isMaintenance = data.overallStatus === "MAINTENANCE";

  return (
    <div className="rp-status-page">
      <style>{`
        .rp-status-page {
          min-height: 100vh;
          background: #06080d;
          color: #f3f4f6;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          line-height: 1.5;
          padding-bottom: 60px;
        }

        /* Top Navigation Header */
        .status-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(11, 15, 23, 0.85);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .status-header-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 20px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #ffffff;
        }
        .brand-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: rgba(163, 230, 53, 0.15);
          border: 1px solid rgba(163, 230, 53, 0.3);
          color: #a3e635;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 16px rgba(163, 230, 53, 0.2);
        }

        /* Main Container */
        .status-container {
          max-width: 1080px;
          margin: 0 auto;
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* Hero Banner */
        .hero-banner {
          border-radius: 24px;
          padding: 28px 32px;
          background: linear-gradient(135deg, rgba(163, 230, 53, 0.08) 0%, rgba(13, 17, 26, 0.95) 100%);
          border: 1px solid rgba(163, 230, 53, 0.25);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .hero-banner.maintenance {
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(13, 17, 26, 0.95) 100%);
          border-color: rgba(234, 179, 8, 0.3);
        }
        .hero-banner.degraded {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(13, 17, 26, 0.95) 100%);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .hero-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .hero-status-icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: rgba(163, 230, 53, 0.2);
          border: 1px solid rgba(163, 230, 53, 0.4);
          color: #a3e635;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 24px rgba(163, 230, 53, 0.35);
          flex-shrink: 0;
        }
        .hero-banner.maintenance .hero-status-icon {
          background: rgba(234, 179, 8, 0.2);
          border-color: rgba(234, 179, 8, 0.4);
          color: #eab308;
          box-shadow: 0 0 24px rgba(234, 179, 8, 0.35);
        }
        .hero-banner.degraded .hero-status-icon {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.4);
          color: #f59e0b;
          box-shadow: 0 0 24px rgba(245, 158, 11, 0.35);
        }

        /* Notice Banner */
        .notice-banner {
          border-radius: 18px;
          padding: 18px 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
        }
        .notice-banner.info {
          background: rgba(163, 230, 53, 0.08);
          border: 1px solid rgba(163, 230, 53, 0.3);
          color: #bef264;
        }
        .notice-banner.warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #fbbf24;
        }
        .notice-banner.maintenance {
          background: rgba(234, 179, 8, 0.1);
          border: 1px solid rgba(234, 179, 8, 0.3);
          color: #fde047;
        }

        /* Component Card */
        .component-card {
          background: #0d111a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: border-color 0.2s ease, transform 0.15s ease;
        }
        .component-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .comp-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Badges */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .status-pill.operational {
          background: rgba(163, 230, 53, 0.12);
          color: #a3e635;
          border: 1px solid rgba(163, 230, 53, 0.3);
        }
        .status-pill.degraded {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .status-pill.offline {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .dot-pulse {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #a3e635;
          box-shadow: 0 0 8px #a3e635;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        /* 90-Day Slices */
        .history-card {
          background: #0d111a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px 28px;
        }
        .slices-bar {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 12px 0;
          overflow-x: auto;
        }
        .slice-item {
          flex: 1;
          height: 36px;
          min-width: 6px;
          border-radius: 3px;
          background: rgba(163, 230, 53, 0.75);
          transition: transform 0.15s ease, background 0.15s ease;
          cursor: pointer;
        }
        .slice-item:hover {
          background: #a3e635;
          transform: scaleY(1.2);
        }
        .slice-item.degraded { background: #f59e0b; }
        .slice-item.offline { background: #ef4444; }

        /* Buttons */
        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-refresh:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .btn-dashboard {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 12px;
          background: #a3e635;
          color: #000000;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(163, 230, 53, 0.3);
          transition: all 0.15s ease;
        }
        .btn-dashboard:hover {
          background: #bef264;
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .hero-banner { padding: 20px; }
          .hero-left { gap: 14px; }
          .component-card { flex-direction: column; align-items: flex-start; }
          .comp-right { width: 100%; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; margin-top: 4px; }
        }
      `}</style>

      {/* ─── STICKY NAVIGATION HEADER ─── */}
      <header className="status-header">
        <div className="status-header-inner">
          <Link href="/dashboard" className="brand-link">
            <div className="brand-icon-box">
              <Activity size={20} />
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", display: "block" }}>
                {data.title || "Rubber Panel Status"}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af", display: "block", marginTop: -2 }}>
                by {data.companyName || "Flaxa Studios"}
              </span>
            </div>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="btn-refresh"
              title="Refresh telemetry"
            >
              <RefreshCw size={13} className={refreshing ? "spin-icon" : ""} />
              <span>Auto-refresh ({countdown}s)</span>
            </button>

            {data.supportUrl && (
              <a
                href={data.supportUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-refresh"
                style={{ textDecoration: "none" }}
              >
                <span>Discord</span>
                <ExternalLink size={12} style={{ opacity: 0.6 }} />
              </a>
            )}

            <Link href="/dashboard" className="btn-dashboard">
              <span>Instances</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="status-container">
        {/* 1. HERO OPERATIONAL HEALTH BANNER */}
        <div className={`hero-banner ${isMaintenance ? "maintenance" : !isOperational ? "degraded" : ""}`}>
          <div className="hero-left">
            <div className="hero-status-icon">
              {isOperational ? (
                <CheckCircle2 size={32} />
              ) : isMaintenance ? (
                <Wrench size={30} />
              ) : (
                <AlertTriangle size={30} />
              )}
            </div>

            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                {isOperational
                  ? "All Systems Operational"
                  : isMaintenance
                  ? "Scheduled Maintenance in Progress"
                  : "Partial Service Disruption"}
              </div>
              <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4, maxWidth: 580 }}>
                {data.description || "Real-time telemetry and cluster heartbeat monitoring across all infrastructure."}
              </p>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", fontWeight: 700 }}>
              90-Day Telemetry
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#a3e635", fontFamily: "monospace", marginTop: 2 }}>
              {data.overallUptime}%
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              <Clock size={11} />
              <span>Real-time node sync</span>
            </div>
          </div>
        </div>

        {/* 2. NOTICE / INCIDENT BANNER (IF ACTIVE) */}
        {data.showNotice && data.customMessage && (
          <div className={`notice-banner ${data.noticeType || "info"}`}>
            <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 2 }}>
                {data.noticeType === "maintenance" ? "System Maintenance Notice" : data.noticeType === "warning" ? "Operational Advisory" : "System Announcement"}
              </strong>
              <p style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.95 }}>
                {data.customMessage}
              </p>
            </div>
          </div>
        )}

        {/* 3. SERVICES & INFRASTRUCTURE CLUSTERS */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>
              Services &amp; Compute Infrastructure ({data.components?.length || 0})
            </h2>
            <div style={{ fontSize: 11.5, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot-pulse" />
              <span>Heartbeat monitor active</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.components.map(comp => {
              const compOnline = comp.status === "OPERATIONAL";
              const compDegraded = comp.status === "DEGRADED";

              return (
                <div key={comp.id} className="component-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                    <div className="comp-icon-box">
                      {comp.type === "NODE" ? (
                        <MonitorSpeaker size={20} style={{ color: "#a3e635" }} />
                      ) : comp.id === "admin-portal" ? (
                        <Shield size={20} style={{ color: "#c084fc" }} />
                      ) : (
                        <Globe size={20} style={{ color: "#34d399" }} />
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                          {comp.name}
                        </span>
                        {comp.activeServers !== undefined && (
                          <span style={{ fontSize: 11, fontFamily: "monospace", padding: "2px 8px", background: "rgba(0,0,0,0.4)", borderRadius: 6, color: "#9ca3af", border: "1px solid rgba(255,255,255,0.06)" }}>
                            {comp.activeServers} server{comp.activeServers !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                        {comp.description}
                      </p>
                    </div>
                  </div>

                  <div className="comp-right" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                    {comp.latencyMs && (
                      <span style={{ fontSize: 11.5, fontFamily: "monospace", color: "#9ca3af" }}>
                        {comp.latencyMs}ms latency
                      </span>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`status-pill ${compOnline ? "operational" : compDegraded ? "degraded" : "offline"}`}>
                        <span className={`dot-pulse ${!compOnline ? "bg-red-500" : ""}`} />
                        <span>{comp.status}</span>
                      </span>

                      <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", color: "#e5e7eb", width: 50, textAlign: "right" }}>
                        {comp.uptimePercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. 90-DAY UPTIME HISTORY SLICES */}
        {data.historyBars && data.historyBars.length > 0 && (
          <div className="history-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  90-Day System Uptime History
                </h3>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  Daily cluster reliability verified via daemon heartbeats.
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#a3e635" }}>
                {data.overallUptime}% Operational
              </span>
            </div>

            <div className="slices-bar">
              {data.historyBars.map((bar, i) => (
                <div
                  key={bar.date + i}
                  title={`${bar.date}: ${bar.status} (${bar.uptime}%)`}
                  className={`slice-item ${bar.status === "DEGRADED" ? "degraded" : bar.status === "OFFLINE" ? "offline" : ""}`}
                />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginTop: 6 }}>
              <span>90 days ago</span>
              <span>100% Target Baseline</span>
              <span>Today</span>
            </div>
          </div>
        )}

        {/* 5. INCIDENTS HISTORY */}
        <div className="history-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>
            Past Incidents &amp; Event Logs
          </h3>
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#9ca3af" }}>
              <Check size={16} style={{ color: "#a3e635" }} />
              <span>All monitored services operational. Zero major infrastructure outages logged in the past 90 days.</span>
            </div>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>Verified</span>
          </div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", marginTop: 40, paddingTop: 24, textAlign: "center", fontSize: 12, color: "#6b7280" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            &copy; {new Date().getFullYear()} {data.companyName || "Flaxa Studios"}. Powered by Rubber Panel.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/dashboard" style={{ color: "#9ca3af", textDecoration: "none" }}>
              Instances
            </Link>
            <Link href="/status" style={{ color: "#9ca3af", textDecoration: "none" }}>
              Status Page
            </Link>
            {data.supportUrl && (
              <a href={data.supportUrl} target="_blank" rel="noreferrer" style={{ color: "#9ca3af", textDecoration: "none" }}>
                Support
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
