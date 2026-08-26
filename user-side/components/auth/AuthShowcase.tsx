"use client";

import Image from "next/image";
import { Server, Terminal, Shield, Zap, Users, Clock, CheckCircle2 } from "lucide-react";

export default function AuthShowcase() {
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        minHeight: 640,
        borderRadius: 24,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "36px 32px",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* Background Minecraft Scene */}
      <Image
        src="/minecraft-hero.jpg"
        alt="Minecraft Server Infrastructure"
        fill
        style={{
          objectFit: "cover",
          objectPosition: "center",
          transform: "scale(1.02)",
          transition: "transform 8s ease",
        }}
        priority
      />

      {/* Deep Gradient Overlays for Readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(10, 15, 26, 0.75) 0%, rgba(10, 15, 26, 0.4) 40%, rgba(8, 12, 22, 0.9) 100%)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.15), transparent 50%)",
          zIndex: 2,
        }}
      />

      {/* Content Container */}
      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
        {/* Top Branding Pill */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 14px 6px 8px",
              background: "rgba(15, 23, 42, 0.7)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 9999,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981, #06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
              }}
            >
              <Server size={14} style={{ color: "#ffffff" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "#ffffff" }}>
              Rubber Panel
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              background: "rgba(16, 185, 129, 0.15)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 9999,
              fontSize: 11.5,
              fontWeight: 600,
              color: "#34d399",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#34d399",
                boxShadow: "0 0 8px #34d399",
              }}
            />
            <span>v2.4 Production Engine</span>
          </div>
        </div>

        {/* Center Hero Message & Floating Feature Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, margin: "auto 0" }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#a78bfa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              <Zap size={13} />
              <span>Next-Gen Minecraft Hosting</span>
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.03em",
                lineHeight: 1.25,
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            >
              High-Performance Control <br />
              For Your Minecraft Universe.
            </h2>
          </div>

          {/* 3 Interactive Feature Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Card 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 14,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                  flexShrink: 0,
                }}
              >
                <Terminal size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Instant Terminal & Auto-Jar Pipeline
                </div>
                <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Paper 1.21.6, Purpur, Fabric, and Forge ready with sub-millisecond execution.
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 14,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fbbf24",
                  flexShrink: 0,
                }}
              >
                <Clock size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Cron Automation & Sequential Pipelines
                </div>
                <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Schedule automatic announcements, periodic restarts, and world backups.
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: 14,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#c084fc",
                  flexShrink: 0,
                }}
              >
                <Users size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
                  Pterodactyl-Style Subusers & Roles
                </div>
                <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Invite team members with custom granular permissions and protected paths.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 12,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
            />
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>All Systems Nominal</span>
          </div>
          <span>99.99% Uptime SLA</span>
        </div>
      </div>
    </div>
  );
}
