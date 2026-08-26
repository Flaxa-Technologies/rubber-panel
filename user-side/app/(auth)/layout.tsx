"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname.includes("register");
  const [branding, setBranding] = useState({
    siteName: "Rubber Panel",
    logoUrl: "/logo.png",
    siteDescription: "Next-Generation Game Server Platform",
  });

  useEffect(() => {
    fetch("/api/user/customization")
      .then(r => r.json())
      .then(d => {
        if (d.customization) {
          setBranding({
            siteName: d.customization["branding.siteName"] || "Rubber Panel",
            logoUrl: d.customization["branding.logoUrl"] || "/logo.png",
            siteDescription: d.customization["branding.siteDescription"] || "Next-Generation Game Server Platform",
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "#080a10",
        padding: "16px",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
      className="auth-screen-container"
    >
      {/* Left Showcase Banner (Full Height Card) */}
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          borderRadius: 24,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "32px",
          boxSizing: "border-box",
        }}
        className="auth-showcase-panel"
      >
        {/* Minecraft Crystal Background Image */}
        <Image
          src="/image.png"
          alt="Rubber Panel Minecraft Infrastructure"
          fill
          style={{
            objectFit: "cover",
            objectPosition: "center",
          }}
          priority
          unoptimized
        />

        {/* Gradient Overlay for Top and Bottom text readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8, 10, 18, 0.65) 0%, rgba(8, 10, 18, 0.1) 40%, rgba(8, 10, 18, 0.88) 100%)",
            zIndex: 1,
          }}
        />

        {/* Top Header: Rubber Panel Logo + Pill Button */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo & Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src={branding.logoUrl || "/logo.png"}
              alt={branding.siteName}
              width={34}
              height={34}
              style={{ borderRadius: 8, objectFit: "contain" }}
              unoptimized
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {branding.siteName}
            </span>
          </div>

          {/* Top-Right Pill Link */}
          <Link
            href={isRegister ? "/login" : "/register"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 16px",
              background: "rgba(255, 255, 255, 0.14)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 9999,
              color: "#ffffff",
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
            className="hover:bg-white/20"
          >
            <span>{isRegister ? "Log in instead" : "Back to welcome"}</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Bottom Headline & Carousel Indicators */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                textShadow: "0 2px 12px rgba(0,0,0,0.6)",
              }}
            >
              Capturing Moments, <br />
              Creating Memories
            </h2>
          </div>

          {/* 3 Pagination Pill Indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 28,
                height: 4,
                borderRadius: 2,
                background: "rgba(255, 255, 255, 0.35)",
              }}
            />
            <div
              style={{
                width: 28,
                height: 4,
                borderRadius: 2,
                background: "rgba(255, 255, 255, 0.35)",
              }}
            />
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "#ffffff",
                boxShadow: "0 0 8px rgba(255,255,255,0.6)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Right Side Form Panel (Centered Full Viewport) */}
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 48px",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440 }}>
          {children}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 900px) {
          .auth-screen-container {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: 100vh !important;
            padding: 16px !important;
          }
          .auth-showcase-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
