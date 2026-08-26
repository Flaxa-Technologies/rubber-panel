"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { CustomizationProvider, useCustomization } from "./CustomizationContext";
import { Sparkles, X, MessageCircle, ArrowRight } from "lucide-react";

function AnnouncementBanner() {
  const { announcementEnabled, announcementTitle, announcementMessage, discord } = useCustomization();
  const [dismissed, setDismissed] = useState(false);

  if (!announcementEnabled || (!announcementTitle && !announcementMessage) || dismissed) return null;

  return (
    <div 
      className="relative mb-5 p-3 sm:px-4 sm:py-3 rounded-2xl border overflow-hidden transition-all animate-fade-in shadow-xl group"
      style={{ 
        background: "linear-gradient(135deg, rgba(20, 20, 24, 0.85) 0%, rgba(10, 10, 14, 0.95) 100%)", 
        borderColor: "rgba(255, 255, 255, 0.12)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.45)"
      }}
    >
      {/* Dynamic Ambient Background Glow */}
      <div 
        className="absolute -top-10 -left-10 w-28 h-28 rounded-full pointer-events-none opacity-25 blur-2xl transition-all group-hover:opacity-40"
        style={{ backgroundColor: "var(--accent-dynamic, #38bdf8)" }}
      />
      <div 
        className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full pointer-events-none opacity-20 blur-2xl"
        style={{ backgroundColor: "#5865F2" }}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Side: Icon + Pill + Title + Message */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm"
            style={{ 
              backgroundColor: "rgba(255, 255, 255, 0.07)", 
              borderColor: "rgba(255, 255, 255, 0.16)",
              color: "var(--accent-dynamic, #38bdf8)"
            }}
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono border"
                style={{ 
                  backgroundColor: "rgba(255, 255, 255, 0.08)", 
                  borderColor: "rgba(255, 255, 255, 0.15)", 
                  color: "#ffffff" 
                }}
              >
                COMMUNITY UPDATE
              </span>
              {announcementTitle && (
                <span className="font-bold text-xs sm:text-sm text-white tracking-tight">
                  {announcementTitle}
                </span>
              )}
            </div>
            {announcementMessage && (
              <p className="text-xs text-zinc-300 font-normal mt-0.5 leading-relaxed truncate max-w-3xl">
                {announcementMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Quick Discord CTA + Dismiss Button */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {discord && (
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 hover:shadow-indigo-500/25"
              style={{ backgroundColor: "#5865F2" }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Join Discord</span>
              <ArrowRight className="w-3 h-3 opacity-80" />
            </a>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss Announcement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ShellContent({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="saas-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 md:relative transition-transform duration-200 md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Viewport */}
      <div className="saas-main">
        <TopBar onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="saas-content">
          <AnnouncementBanner />
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function UserShell({ children }: { children: React.ReactNode }) {
  return (
    <CustomizationProvider>
      <ShellContent>{children}</ShellContent>
    </CustomizationProvider>
  );
}
