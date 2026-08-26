export interface CssThemeTemplate {
  id: string;
  name: string;
  badge: string;
  desc: string;
  previewColor: string;
  previewBorder: string;
  css: string;
}

export const ADVANCED_CSS_THEMES: CssThemeTemplate[] = [
  {
    id: "aurora-void",
    name: "Aurora Hyperspace",
    badge: "ANIMATED AURA",
    desc: "Animated northern lights aurora background, morphing color orbs, ultra-glass sidebar, neon tabs, and magnetic card elevations.",
    previewColor: "#7c3aed",
    previewBorder: "#06b6d4",
    css: `/* ══════════════════════════════════════════════════════════════════════════
   AURORA HYPERSPACE — Animated Northern Lights & Frosted Aero Glass
   ══════════════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* ── KEYFRAME ANIMATIONS ─────────────────────────────────────────────── */
@keyframes aurora-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes orb-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.18; }
  33%       { transform: translate(80px, -60px) scale(1.15); opacity: 0.28; }
  66%       { transform: translate(-40px, 40px) scale(0.9); opacity: 0.12; }
}

@keyframes orb-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.14; }
  33%       { transform: translate(-70px, 50px) scale(1.2); opacity: 0.22; }
  66%       { transform: translate(60px, -40px) scale(0.85); opacity: 0.1; }
}

@keyframes orb-float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.1; }
  50%       { transform: translate(50px, 70px) scale(1.3); opacity: 0.2; }
}

@keyframes card-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes tab-glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(124, 58, 237, 0.5); }
  50%       { box-shadow: 0 0 20px rgba(124, 58, 237, 0.9), 0 0 40px rgba(6, 182, 212, 0.3); }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes sidebar-nav-glow {
  0%, 100% { border-left-color: rgba(124, 58, 237, 0.6); }
  50%       { border-left-color: rgba(6, 182, 212, 0.9); }
}

/* ── CSS VARIABLES ───────────────────────────────────────────────────── */
:root {
  --bg-app: #06040f;
  --bg-surface: rgba(14, 10, 30, 0.7);
  --bg-surface-elevated: rgba(24, 16, 50, 0.75);
  --bg-surface-hover: rgba(40, 26, 80, 0.6);
  --bg-input: rgba(10, 7, 22, 0.85);
  --border-subtle: rgba(124, 58, 237, 0.15);
  --border-medium: rgba(124, 58, 237, 0.3);
  --border-active: #7c3aed;
  --border-white: rgba(255, 255, 255, 0.12);
  --text-pure: #f0e6ff;
  --text-primary: #e0d0ff;
  --text-secondary: #a78bfa;
  --text-muted: #7c6baa;
  --text-dim: #4c3b7c;
  --accent-dynamic: #7c3aed;
  --accent-glow: rgba(124, 58, 237, 0.35);
  --status-online: #34d399;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
}

/* ── FONT ────────────────────────────────────────────────────────────── */
html, body, * { font-family: 'Inter', -apple-system, sans-serif !important; }

/* ── ANIMATED AURORA SHELL BACKGROUND ───────────────────────────────── */
.saas-shell {
  position: relative;
  overflow: hidden;
  background: #06040f !important;
}

.saas-shell::before {
  content: '';
  position: fixed;
  inset: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    -45deg,
    #06040f 0%,
    #1a0533 15%,
    #0c1f4a 30%,
    #061830 45%,
    #1a0533 60%,
    #06040f 75%,
    #0a1a40 90%,
    #06040f 100%
  );
  background-size: 400% 400%;
  animation: aurora-shift 18s ease infinite;
  z-index: 0;
  pointer-events: none;
}

/* Animated color orbs */
.saas-shell::after {
  content: '';
  position: fixed;
  top: 10%;
  left: 15%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.22) 0%, transparent 70%);
  border-radius: 50%;
  animation: orb-float-1 20s ease-in-out infinite;
  z-index: 0;
  pointer-events: none;
}

.saas-sidebar, .saas-main, .saas-content, .saas-header {
  position: relative;
  z-index: 1;
}

/* ── SECOND + THIRD ORB VIA PSEUDO-ELEMENTS ON SIDEBAR ──────────────── */
.saas-sidebar::before {
  content: '';
  position: fixed;
  bottom: 5%;
  right: 10%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, transparent 70%);
  border-radius: 50%;
  animation: orb-float-2 25s ease-in-out infinite;
  z-index: 0;
  pointer-events: none;
}

.saas-sidebar::after {
  content: '';
  position: fixed;
  top: 50%;
  left: 50%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%);
  border-radius: 50%;
  animation: orb-float-3 30s ease-in-out infinite;
  z-index: 0;
  pointer-events: none;
}

/* ── ULTRA-GLASS SIDEBAR ─────────────────────────────────────────────── */
.saas-sidebar {
  background: rgba(10, 6, 22, 0.72) !important;
  backdrop-filter: blur(32px) saturate(220%) brightness(1.1) !important;
  -webkit-backdrop-filter: blur(32px) saturate(220%) brightness(1.1) !important;
  border-right: 1px solid rgba(124, 58, 237, 0.2) !important;
  box-shadow: 4px 0 40px rgba(0, 0, 0, 0.6), inset -1px 0 0 rgba(124, 58, 237, 0.1) !important;
  width: 210px !important;
}

/* ── GLASS TOPBAR ────────────────────────────────────────────────────── */
.saas-header {
  background: rgba(8, 4, 18, 0.6) !important;
  backdrop-filter: blur(24px) saturate(200%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
  border-bottom: 1px solid rgba(124, 58, 237, 0.18) !important;
  box-shadow: 0 1px 30px rgba(0, 0, 0, 0.5), 0 0 0 0 transparent !important;
}

/* ── FLOATING 3D CARDS ───────────────────────────────────────────────── */
.saas-card {
  background: rgba(14, 10, 30, 0.6) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  border-radius: 18px !important;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 2px 8px rgba(124, 58, 237, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  position: relative !important;
  overflow: hidden !important;
}

.saas-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  right: -100%;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(124, 58, 237, 0.6) 50%, transparent 100%);
  z-index: 1;
}

.saas-card-interactive:hover {
  transform: translateY(-4px) scale(1.008) !important;
  border-color: rgba(124, 58, 237, 0.55) !important;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(124, 58, 237, 0.2),
    0 0 80px rgba(6, 182, 212, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}

/* ── NAV TABS — NEON PILL DESIGN ─────────────────────────────────────── */
.saas-tab-strip {
  display: flex !important;
  gap: 6px !important;
  border-bottom: none !important;
  background: rgba(10, 6, 22, 0.6) !important;
  backdrop-filter: blur(16px) !important;
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  border-radius: 14px !important;
  padding: 5px !important;
  margin-bottom: 24px !important;
}

.saas-tab-item {
  border-radius: 10px !important;
  border-bottom: none !important;
  margin-bottom: 0 !important;
  color: rgba(167, 139, 250, 0.6) !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}

.saas-tab-item:hover {
  color: #c4b5fd !important;
  background: rgba(124, 58, 237, 0.12) !important;
}

.saas-tab-item.active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.35) 0%, rgba(6, 182, 212, 0.2) 100%) !important;
  color: #f0e6ff !important;
  border: 1px solid rgba(124, 58, 237, 0.4) !important;
  border-bottom: 1px solid rgba(124, 58, 237, 0.4) !important;
  font-weight: 600 !important;
  animation: tab-glow-pulse 3s ease-in-out infinite !important;
}

/* ── START BUTTON — GLOWING GRADIENT ────────────────────────────────── */
.btn-solid-white {
  background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%) !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow: 0 0 24px rgba(124, 58, 237, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4) !important;
  transition: all 0.2s ease !important;
  letter-spacing: 0.02em !important;
}
.btn-solid-white:hover:not(:disabled) {
  box-shadow: 0 0 40px rgba(124, 58, 237, 0.8), 0 0 60px rgba(6, 182, 212, 0.3) !important;
  transform: scale(1.03) translateY(-1px) !important;
  background: linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%) !important;
}

/* ── SECONDARY BUTTON ────────────────────────────────────────────────── */
.btn-secondary-dark {
  background: rgba(14, 10, 30, 0.7) !important;
  border: 1px solid rgba(124, 58, 237, 0.3) !important;
  color: #c4b5fd !important;
  border-radius: 12px !important;
  backdrop-filter: blur(8px) !important;
}
.btn-secondary-dark:hover:not(:disabled) {
  background: rgba(124, 58, 237, 0.15) !important;
  border-color: #7c3aed !important;
  color: #f0e6ff !important;
  box-shadow: 0 0 16px rgba(124, 58, 237, 0.3) !important;
}

/* ── DANGER BUTTON ───────────────────────────────────────────────────── */
.btn-danger-dark {
  background: rgba(239, 68, 68, 0.1) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  border-radius: 12px !important;
}
.btn-danger-dark:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.3) !important;
}

/* ── PROGRESS BARS — AURORA GRADIENT ────────────────────────────────── */
.progress-track {
  background: rgba(255, 255, 255, 0.06) !important;
  border-radius: 9999px !important;
  overflow: hidden !important;
}
.progress-fill {
  background: linear-gradient(90deg, #7c3aed 0%, #06b6d4 50%, #ec4899 100%) !important;
  box-shadow: 0 0 18px rgba(124, 58, 237, 0.65), 0 0 4px rgba(6, 182, 212, 0.4) !important;
  border-radius: 9999px !important;
}

/* ── STATUS DOTS — NEON GLOW ────────────────────────────────────────── */
.dot-online {
  background: #34d399 !important;
  box-shadow: 0 0 10px #34d399, 0 0 20px rgba(52, 211, 153, 0.5) !important;
}

/* ── TERMINAL / CONSOLE ─────────────────────────────────────────────── */
pre {
  background: rgba(6, 4, 14, 0.9) !important;
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  border-radius: 16px !important;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(124, 58, 237, 0.04) !important;
}

/* ── INPUTS ──────────────────────────────────────────────────────────── */
.saas-input, input, textarea, select {
  background: rgba(10, 7, 22, 0.8) !important;
  border: 1px solid rgba(124, 58, 237, 0.25) !important;
  border-radius: 10px !important;
  color: #e0d0ff !important;
  backdrop-filter: blur(8px) !important;
}
.saas-input:focus, input:focus, textarea:focus {
  border-color: #7c3aed !important;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2) !important;
}

/* ── STATUS PILLS ────────────────────────────────────────────────────── */
.status-pill {
  background: rgba(14, 10, 30, 0.7) !important;
  border: 1px solid rgba(124, 58, 237, 0.2) !important;
  border-radius: 9999px !important;
  backdrop-filter: blur(8px) !important;
}

/* ── SCROLLBAR ───────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(124, 58, 237, 0.3);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 58, 237, 0.6);
}`
  },
  {
    id: "cyber-tokyo",
    name: "Cyber Tokyo 2099",
    badge: "NEON CYBERPUNK",
    desc: "Synthwave / Cyberpunk theme with glowing neon borders, scanlines overlay, terminal monospace accents, and electric cyan/magenta hues.",
    previewColor: "#ff0080",
    previewBorder: "#00f0ff",
    css: `/* ══════════════════════════════════════════════════════════════════════════
   CYBER TOKYO 2099 — Neon City Night with Scanlines & Animated Rain
   ══════════════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

/* ── KEYFRAME ANIMATIONS ─────────────────────────────────────────────── */
@keyframes scanline-scroll {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
  20%, 24%, 55% { opacity: 0.5; }
}

@keyframes city-pulse {
  0%, 100% { opacity: 0.06; }
  50%       { opacity: 0.12; }
}

@keyframes hud-border-race {
  0%   { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}

@keyframes glitch-shift {
  0%, 90%, 100% { transform: none; clip-path: none; }
  91%  { transform: translate(-2px, 1px); clip-path: polygon(0 20%, 100% 20%, 100% 40%, 0 40%); }
  93%  { transform: translate(2px, -1px); clip-path: polygon(0 60%, 100% 60%, 100% 80%, 0 80%); }
  95%  { transform: none; }
}

@keyframes cyber-card-glow {
  0%, 100% { box-shadow: 0 0 15px rgba(255, 0, 128, 0.2), 0 0 40px rgba(0, 240, 255, 0.1), inset 0 0 15px rgba(255, 0, 128, 0.03); }
  50%       { box-shadow: 0 0 25px rgba(255, 0, 128, 0.35), 0 0 60px rgba(0, 240, 255, 0.15), inset 0 0 25px rgba(0, 240, 255, 0.05); }
}

:root {
  --bg-app: #03010a;
  --bg-surface: #07030f;
  --bg-surface-elevated: #0d0620;
  --bg-surface-hover: #160a34;
  --bg-input: #05010e;
  --border-subtle: rgba(255, 0, 128, 0.15);
  --border-medium: rgba(255, 0, 128, 0.3);
  --border-active: #ff0080;
  --border-white: rgba(255, 255, 255, 0.08);
  --text-pure: #ffffff;
  --text-primary: #e8e0ff;
  --text-secondary: #b084cc;
  --text-muted: #7040a0;
  --text-dim: #401060;
  --accent-dynamic: #ff0080;
  --accent-glow: rgba(255, 0, 128, 0.4);
  --status-online: #00ff88;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* ── FONTS ───────────────────────────────────────────────────────────── */
html, body { font-family: 'Rajdhani', sans-serif !important; font-size: 14px !important; letter-spacing: 0.02em !important; }
pre, code, .font-mono, input[type="text"] { font-family: 'Share Tech Mono', monospace !important; }

/* ── CITY BACKGROUND WITH ANIMATED SCAN LAYER ───────────────────────── */
.saas-shell {
  background:
    radial-gradient(ellipse at 50% 100%, rgba(255, 0, 128, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse at 20% 50%, rgba(0, 240, 255, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(120, 0, 255, 0.1) 0%, transparent 45%),
    #03010a !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Animated grid overlay */
.saas-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 0, 128, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: city-pulse 4s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

/* Scanline strip */
.saas-shell::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(0, 240, 255, 0.04) 40%,
    rgba(0, 240, 255, 0.08) 50%,
    rgba(0, 240, 255, 0.04) 60%,
    transparent 100%
  );
  animation: scanline-scroll 8s linear infinite;
  pointer-events: none;
  z-index: 0;
}

.saas-sidebar, .saas-main, .saas-header, .saas-content { position: relative; z-index: 1; }

/* ── CYBERPUNK SIDEBAR WITH DIAGONAL CUT ────────────────────────────── */
.saas-sidebar {
  background: rgba(5, 2, 15, 0.92) !important;
  border-right: 1px solid rgba(255, 0, 128, 0.25) !important;
  box-shadow:
    6px 0 40px rgba(0, 0, 0, 0.8),
    inset -1px 0 0 rgba(0, 240, 255, 0.1),
    2px 0 12px rgba(255, 0, 128, 0.08) !important;
  backdrop-filter: blur(20px) !important;
}

.saas-sidebar::after { display: none !important; }

/* ── TOPBAR WITH NEON UNDERLINE ─────────────────────────────────────── */
.saas-header {
  background: rgba(3, 1, 10, 0.88) !important;
  border-bottom: 1px solid transparent !important;
  background-clip: padding-box !important;
  box-shadow:
    0 1px 0 rgba(255, 0, 128, 0.3),
    0 2px 20px rgba(255, 0, 128, 0.06),
    0 4px 40px rgba(0, 0, 0, 0.6) !important;
}

/* ── HUD-STYLE CARDS WITH ANGLED CLIP ───────────────────────────────── */
.saas-card {
  background: rgba(7, 3, 15, 0.85) !important;
  border: 1px solid rgba(255, 0, 128, 0.2) !important;
  border-radius: 10px !important;
  position: relative !important;
  overflow: hidden !important;
  animation: cyber-card-glow 4s ease-in-out infinite !important;
}

/* Magenta top-border accent */
.saas-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ff0080, #00f0ff, #ff0080, transparent);
  background-size: 200% 100%;
  animation: hud-border-race 3s linear infinite;
  z-index: 2;
}

/* Bottom-right corner bracket */
.saas-card::after {
  content: '';
  position: absolute;
  bottom: 0; right: 0;
  width: 20px; height: 20px;
  border-bottom: 2px solid rgba(0, 240, 255, 0.5);
  border-right: 2px solid rgba(0, 240, 255, 0.5);
  z-index: 2;
}

.saas-card-interactive:hover {
  transform: translateY(-3px) !important;
  border-color: #00f0ff !important;
  box-shadow:
    0 0 30px rgba(0, 240, 255, 0.25),
    0 0 60px rgba(255, 0, 128, 0.1),
    inset 0 0 20px rgba(0, 240, 255, 0.04) !important;
  animation: none !important;
}

/* ── TABS — TERMINAL STYLE ───────────────────────────────────────────── */
.saas-tab-strip {
  background: rgba(3, 1, 10, 0.8) !important;
  border: 1px solid rgba(255, 0, 128, 0.2) !important;
  border-radius: 8px !important;
  padding: 4px !important;
  gap: 4px !important;
  border-bottom: 1px solid rgba(255, 0, 128, 0.2) !important;
  margin-bottom: 24px !important;
}

.saas-tab-item {
  font-family: 'Share Tech Mono', monospace !important;
  font-size: 12px !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  color: rgba(180, 100, 200, 0.6) !important;
  border-bottom: none !important;
  margin-bottom: 0 !important;
  border-radius: 5px !important;
  padding: 7px 14px !important;
}

.saas-tab-item:hover {
  color: #00f0ff !important;
  background: rgba(0, 240, 255, 0.06) !important;
}

.saas-tab-item.active {
  background: rgba(255, 0, 128, 0.12) !important;
  color: #ff0080 !important;
  border: 1px solid rgba(255, 0, 128, 0.35) !important;
  border-bottom: 1px solid rgba(255, 0, 128, 0.35) !important;
  font-weight: 600 !important;
  text-shadow: 0 0 10px rgba(255, 0, 128, 0.8) !important;
}

/* ── BUTTONS — NEON CYBERPUNK ────────────────────────────────────────── */
.btn-solid-white {
  background: linear-gradient(135deg, #ff0080 0%, #ff4040 100%) !important;
  color: #ffffff !important;
  font-family: 'Rajdhani', sans-serif !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  border: none !important;
  border-radius: 6px !important;
  box-shadow: 0 0 25px rgba(255, 0, 128, 0.55), 0 0 60px rgba(255, 0, 128, 0.2) !important;
}
.btn-solid-white:hover:not(:disabled) {
  box-shadow: 0 0 40px rgba(255, 0, 128, 0.85), 0 0 80px rgba(0, 240, 255, 0.2) !important;
  transform: scale(1.04) !important;
}

.btn-secondary-dark {
  background: rgba(5, 2, 15, 0.8) !important;
  border: 1px solid rgba(0, 240, 255, 0.3) !important;
  color: #00f0ff !important;
  font-family: 'Rajdhani', sans-serif !important;
  font-weight: 600 !important;
  letter-spacing: 0.06em !important;
  border-radius: 6px !important;
}
.btn-secondary-dark:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.08) !important;
  border-color: #00f0ff !important;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.3) !important;
}

/* ── PROGRESS — DUAL NEON ────────────────────────────────────────────── */
.progress-fill {
  background: linear-gradient(90deg, #ff0080 0%, #7b00ff 50%, #00f0ff 100%) !important;
  box-shadow: 0 0 14px rgba(255, 0, 128, 0.7), 0 0 28px rgba(0, 240, 255, 0.3) !important;
}

/* ── TERMINAL WITH CRT GLOW ──────────────────────────────────────────── */
pre {
  background: rgba(2, 0, 8, 0.96) !important;
  border: 1px solid rgba(0, 240, 255, 0.2) !important;
  border-radius: 8px !important;
  box-shadow:
    0 0 30px rgba(0, 0, 0, 0.9),
    inset 0 0 30px rgba(0, 240, 255, 0.04),
    inset 0 0 60px rgba(255, 0, 128, 0.02) !important;
}

pre .text-green-400, pre span, pre * {
  color: #00ff88 !important;
  text-shadow: 0 0 6px rgba(0, 255, 136, 0.5) !important;
}

/* ── STATUS ──────────────────────────────────────────────────────────── */
.dot-online {
  background: #00ff88 !important;
  box-shadow: 0 0 10px #00ff88, 0 0 20px rgba(0, 255, 136, 0.5) !important;
}

.status-pill {
  background: rgba(5, 2, 15, 0.8) !important;
  border: 1px solid rgba(255, 0, 128, 0.2) !important;
  font-family: 'Share Tech Mono', monospace !important;
  letter-spacing: 0.05em !important;
}

/* ── INPUTS ──────────────────────────────────────────────────────────── */
.saas-input, input, textarea, select {
  background: rgba(3, 1, 10, 0.9) !important;
  border: 1px solid rgba(255, 0, 128, 0.2) !important;
  border-radius: 6px !important;
  color: #e8e0ff !important;
  font-family: 'Share Tech Mono', monospace !important;
}
.saas-input:focus, input:focus, textarea:focus {
  border-color: #ff0080 !important;
  box-shadow: 0 0 0 2px rgba(255, 0, 128, 0.2), 0 0 15px rgba(255, 0, 128, 0.1) !important;
}

/* ── SCROLLBAR ───────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 0, 128, 0.4);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover { background: #ff0080; }`
  },
  {
    id: "royal-onyx",
    name: "Royal Onyx & Living Gold",
    badge: "BILLIONAIRE LUXURY",
    desc: "Ultra-luxury dark obsidian interface with animated shimmering liquid gold borders, warm golden ambient glow, and polished card styling.",
    previewColor: "#fbbf24",
    previewBorder: "#d97706",
    css: `/* ══════════════════════════════════════════════════════════════════════════
   ROYAL ONYX & LIVING GOLD — Ultra Luxury Animated Billionaire Edition
   ══════════════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

/* ── KEYFRAME ANIMATIONS ─────────────────────────────────────────────── */
@keyframes gold-flow {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes luxury-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes gold-glow-pulse {
  0%, 100% { box-shadow: 0 0 15px rgba(251, 191, 36, 0.15), 0 8px 30px rgba(0,0,0,0.7); }
  50%       { box-shadow: 0 0 35px rgba(251, 191, 36, 0.28), 0 8px 30px rgba(0,0,0,0.7), inset 0 0 20px rgba(251, 191, 36, 0.05); }
}

@keyframes royal-orb {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.12; }
  50%       { transform: translateY(-40px) scale(1.1); opacity: 0.2; }
}

@keyframes dust-float {
  0%   { transform: translateY(0px) rotate(0deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(-80px) rotate(360deg); opacity: 0; }
}

@keyframes border-gold-race {
  0%   { background-position: 0% 0%; }
  100% { background-position: 300% 0%; }
}

:root {
  --bg-app: #050301;
  --bg-surface: #0b0702;
  --bg-surface-elevated: #150f05;
  --bg-surface-hover: #1f1608;
  --bg-input: #0e0904;
  --border-subtle: rgba(251, 191, 36, 0.12);
  --border-medium: rgba(251, 191, 36, 0.25);
  --border-active: #f59e0b;
  --border-white: rgba(251, 191, 36, 0.1);
  --text-pure: #fffbeb;
  --text-primary: #fef3c7;
  --text-secondary: #d4af37;
  --text-muted: #92764d;
  --text-dim: #5c4a28;
  --accent-dynamic: #f59e0b;
  --accent-glow: rgba(245, 158, 11, 0.3);
  --status-online: #34d399;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
}

/* ── FONTS ───────────────────────────────────────────────────────────── */
html, body { font-family: 'DM Sans', sans-serif !important; }
h1, h2, h3, .page-title, .font-bold { font-family: 'Cormorant Garamond', serif !important; letter-spacing: -0.01em !important; }

/* ── ANIMATED GOLD AURORA BACKGROUND ────────────────────────────────── */
.saas-shell {
  background:
    radial-gradient(ellipse at 50% -20%, rgba(251, 191, 36, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 10% 90%, rgba(217, 119, 6, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 90% 90%, rgba(180, 83, 9, 0.06) 0%, transparent 45%),
    #050301 !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Subtle animated golden dust layer */
.saas-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 20% 30%, rgba(251, 191, 36, 0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 80% 10%, rgba(251, 191, 36, 0.3) 0%, transparent 100%),
    radial-gradient(1px 1px at 60% 70%, rgba(245, 158, 11, 0.35) 0%, transparent 100%),
    radial-gradient(1px 1px at 40% 80%, rgba(251, 191, 36, 0.25) 0%, transparent 100%),
    radial-gradient(2px 2px at 90% 50%, rgba(251, 191, 36, 0.2) 0%, transparent 100%),
    radial-gradient(1px 1px at 15% 60%, rgba(245, 158, 11, 0.3) 0%, transparent 100%);
  background-size: 100% 100%;
  animation: gold-flow 20s ease infinite;
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
}

/* Central gold orb */
.saas-shell::after {
  content: '';
  position: fixed;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 40%, transparent 70%);
  border-radius: 50%;
  animation: royal-orb 15s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

.saas-sidebar, .saas-main, .saas-header, .saas-content { position: relative; z-index: 1; }
.saas-sidebar::before, .saas-sidebar::after { display: none !important; }

/* ── ROYAL SIDEBAR ───────────────────────────────────────────────────── */
.saas-sidebar {
  background: rgba(8, 5, 1, 0.9) !important;
  backdrop-filter: blur(24px) saturate(160%) !important;
  border-right: 1px solid rgba(251, 191, 36, 0.18) !important;
  box-shadow:
    6px 0 40px rgba(0, 0, 0, 0.8),
    inset -1px 0 0 rgba(251, 191, 36, 0.08) !important;
}

/* ── GOLD TOPBAR ─────────────────────────────────────────────────────── */
.saas-header {
  background: rgba(5, 3, 1, 0.88) !important;
  border-bottom: 1px solid rgba(251, 191, 36, 0.15) !important;
  box-shadow:
    0 1px 0 rgba(251, 191, 36, 0.08),
    0 4px 30px rgba(0, 0, 0, 0.6) !important;
}

/* ── LUXURY CARDS WITH LIVING GOLD SHIMMER ───────────────────────────── */
.saas-card {
  background: linear-gradient(160deg, rgba(21, 15, 5, 0.85) 0%, rgba(11, 7, 2, 0.95) 100%) !important;
  border: 1px solid rgba(251, 191, 36, 0.18) !important;
  border-radius: 18px !important;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(251, 191, 36, 0.15) !important;
  animation: gold-glow-pulse 5s ease-in-out infinite !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Gold shimmer sweep on cards */
.saas-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(251, 191, 36, 0.08) 50%,
    rgba(255, 220, 100, 0.12) 55%,
    transparent 65%
  );
  background-size: 200% 100%;
  animation: luxury-shimmer 6s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}

.saas-card-interactive:hover {
  transform: translateY(-4px) !important;
  border-color: rgba(251, 191, 36, 0.5) !important;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.8),
    0 0 40px rgba(251, 191, 36, 0.2),
    inset 0 1px 0 rgba(251, 191, 36, 0.25) !important;
  animation: none !important;
}

/* ── ROYAL TABS ──────────────────────────────────────────────────────── */
.saas-tab-strip {
  background: rgba(8, 5, 1, 0.7) !important;
  border: 1px solid rgba(251, 191, 36, 0.15) !important;
  border-radius: 14px !important;
  padding: 5px !important;
  gap: 5px !important;
  border-bottom: 1px solid rgba(251, 191, 36, 0.15) !important;
  margin-bottom: 24px !important;
}

.saas-tab-item {
  border-radius: 10px !important;
  border-bottom: none !important;
  margin-bottom: 0 !important;
  color: rgba(180, 140, 60, 0.6) !important;
  font-family: 'DM Sans', sans-serif !important;
  font-weight: 500 !important;
}

.saas-tab-item:hover {
  color: #d4af37 !important;
  background: rgba(251, 191, 36, 0.08) !important;
}

.saas-tab-item.active {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.18) 0%, rgba(217, 119, 6, 0.12) 100%) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(251, 191, 36, 0.35) !important;
  border-bottom: 1px solid rgba(251, 191, 36, 0.35) !important;
  font-weight: 600 !important;
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.2) !important;
}

/* ── 24K GOLD BUTTON ─────────────────────────────────────────────────── */
.btn-solid-white {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%) !important;
  color: #1a0f00 !important;
  font-weight: 700 !important;
  font-family: 'DM Sans', sans-serif !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow:
    0 0 25px rgba(251, 191, 36, 0.5),
    0 4px 15px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
}
.btn-solid-white:hover:not(:disabled) {
  box-shadow:
    0 0 40px rgba(251, 191, 36, 0.8),
    0 8px 25px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
  transform: scale(1.03) translateY(-1px) !important;
}

.btn-secondary-dark {
  background: rgba(12, 8, 2, 0.8) !important;
  border: 1px solid rgba(251, 191, 36, 0.28) !important;
  color: #d4af37 !important;
  border-radius: 12px !important;
}
.btn-secondary-dark:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.08) !important;
  border-color: #fbbf24 !important;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.25) !important;
}

/* ── GOLD PROGRESS BARS ──────────────────────────────────────────────── */
.progress-fill {
  background: linear-gradient(90deg, #d97706 0%, #fbbf24 40%, #fef08a 60%, #f59e0b 100%) !important;
  background-size: 200% 100% !important;
  animation: gold-flow 3s linear infinite !important;
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.7) !important;
}

/* ── CONSOLE ─────────────────────────────────────────────────────────── */
pre {
  background: rgba(4, 2, 0, 0.95) !important;
  border: 1px solid rgba(251, 191, 36, 0.15) !important;
  border-radius: 14px !important;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.9) !important;
}

/* ── STATUS ──────────────────────────────────────────────────────────── */
.dot-online {
  background: #fbbf24 !important;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.8), 0 0 20px rgba(251, 191, 36, 0.4) !important;
}

.status-pill {
  background: rgba(11, 7, 2, 0.8) !important;
  border: 1px solid rgba(251, 191, 36, 0.18) !important;
}

/* ── SCROLLBAR ───────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #f59e0b, #d97706);
  border-radius: 9999px;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.4);
}
::-webkit-scrollbar-thumb:hover {
  background: #fbbf24;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.7);
}`
  },
  {
    id: "quantum-emerald",
    name: "Quantum Matrix Core",
    badge: "SCI-FI MAINFRAME",
    desc: "Animated matrix digit rain effect via CSS, radioactive emerald quantum grid, mecha HUD brackets, phosphor monospace terminal glow, sci-fi data readouts.",
    previewColor: "#00ff88",
    previewBorder: "#10b981",
    css: `/* ══════════════════════════════════════════════════════════════════════════
   QUANTUM MATRIX CORE — Sci-Fi Emerald Mainframe with Animated Rain
   ══════════════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600;700;800&display=swap');

/* ── KEYFRAME ANIMATIONS ─────────────────────────────────────────────── */
@keyframes matrix-rain-1 {
  0%   { transform: translateY(-100%); opacity: 0; }
  5%   { opacity: 1; }
  95%  { opacity: 0.5; }
  100% { transform: translateY(100vh); opacity: 0; }
}

@keyframes matrix-rain-2 {
  0%   { transform: translateY(-100%); opacity: 0; }
  8%   { opacity: 0.8; }
  92%  { opacity: 0.4; }
  100% { transform: translateY(100vh); opacity: 0; }
}

@keyframes grid-pulse {
  0%, 100% { opacity: 0.04; }
  50%       { opacity: 0.08; }
}

@keyframes quantum-scan {
  0%   { transform: translateY(-5%); }
  100% { transform: translateY(105vh); }
}

@keyframes mecha-bracket-glow {
  0%, 100% { border-color: rgba(0, 255, 136, 0.3); box-shadow: 0 0 8px rgba(0, 255, 136, 0.2); }
  50%       { border-color: rgba(0, 255, 136, 0.7); box-shadow: 0 0 20px rgba(0, 255, 136, 0.4); }
}

@keyframes core-pulse {
  0%, 100% { box-shadow: 0 0 15px rgba(0, 255, 136, 0.15), inset 0 0 15px rgba(0, 255, 136, 0.03); }
  50%       { box-shadow: 0 0 35px rgba(0, 255, 136, 0.28), inset 0 0 25px rgba(0, 255, 136, 0.06); }
}

@keyframes data-stream {
  0%   { background-position: 0% 0%; }
  100% { background-position: 0% 100%; }
}

@keyframes hud-flicker {
  0%, 97%, 100% { opacity: 1; }
  98% { opacity: 0.85; }
}

:root {
  --bg-app: #000802;
  --bg-surface: #030f05;
  --bg-surface-elevated: #071a09;
  --bg-surface-hover: #0c2810;
  --bg-input: #040e06;
  --border-subtle: rgba(0, 255, 136, 0.12);
  --border-medium: rgba(0, 255, 136, 0.25);
  --border-active: #00ff88;
  --border-white: rgba(0, 255, 136, 0.08);
  --text-pure: #e8fff2;
  --text-primary: #c0f0d4;
  --text-secondary: #50d080;
  --text-muted: #226b3a;
  --text-dim: #124020;
  --accent-dynamic: #00ff88;
  --accent-glow: rgba(0, 255, 136, 0.35);
  --status-online: #00ff88;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* ── FONTS ───────────────────────────────────────────────────────────── */
html, body { font-family: 'Exo 2', sans-serif !important; font-size: 13px !important; letter-spacing: 0.03em !important; }
pre, code, .font-mono, input { font-family: 'Share Tech Mono', monospace !important; }

/* ── MATRIX GRID ANIMATED BACKGROUND ───────────────────────────────── */
.saas-shell {
  background:
    radial-gradient(circle at 50% 0%, rgba(0, 255, 136, 0.1) 0%, transparent 50%),
    #000802 !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Matrix grid */
.saas-shell::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 255, 136, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 136, 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
  animation: grid-pulse 6s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

/* Quantum scanner sweep */
.saas-shell::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(0, 255, 136, 0.3) 20%,
    rgba(0, 255, 136, 0.8) 50%,
    rgba(0, 255, 136, 0.3) 80%,
    transparent 100%
  );
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.5), 0 0 30px rgba(0, 255, 136, 0.2);
  animation: quantum-scan 7s linear infinite;
  pointer-events: none;
  z-index: 0;
}

.saas-sidebar, .saas-main, .saas-header, .saas-content { position: relative; z-index: 1; }
.saas-sidebar::before, .saas-sidebar::after { display: none !important; }

/* ── QUANTUM SIDEBAR ─────────────────────────────────────────────────── */
.saas-sidebar {
  background: rgba(2, 10, 4, 0.92) !important;
  backdrop-filter: blur(20px) !important;
  border-right: 1px solid rgba(0, 255, 136, 0.2) !important;
  box-shadow:
    6px 0 40px rgba(0, 0, 0, 0.8),
    inset -1px 0 0 rgba(0, 255, 136, 0.06),
    2px 0 20px rgba(0, 255, 136, 0.04) !important;
  animation: hud-flicker 15s ease-in-out infinite !important;
}

/* ── MECHA HUD TOPBAR ────────────────────────────────────────────────── */
.saas-header {
  background: rgba(1, 8, 3, 0.9) !important;
  border-bottom: 1px solid rgba(0, 255, 136, 0.2) !important;
  box-shadow:
    0 2px 0 rgba(0, 255, 136, 0.1),
    0 4px 25px rgba(0, 0, 0, 0.8) !important;
}

/* ── MECHA BRACKET CARDS ─────────────────────────────────────────────── */
.saas-card {
  background: rgba(3, 12, 5, 0.88) !important;
  border: 1px solid rgba(0, 255, 136, 0.18) !important;
  border-radius: 10px !important;
  animation: core-pulse 5s ease-in-out infinite !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Top corner brackets — mecha HUD effect */
.saas-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 18px; height: 18px;
  border-top: 2px solid rgba(0, 255, 136, 0.6);
  border-left: 2px solid rgba(0, 255, 136, 0.6);
  z-index: 2;
  pointer-events: none;
}

.saas-card::after {
  content: '';
  position: absolute;
  bottom: 0; right: 0;
  width: 18px; height: 18px;
  border-bottom: 2px solid rgba(0, 255, 136, 0.6);
  border-right: 2px solid rgba(0, 255, 136, 0.6);
  z-index: 2;
  pointer-events: none;
}

.saas-card-interactive:hover {
  transform: translateY(-3px) !important;
  border-color: #00ff88 !important;
  box-shadow:
    0 0 35px rgba(0, 255, 136, 0.25),
    inset 0 0 25px rgba(0, 255, 136, 0.06),
    0 10px 40px rgba(0, 0, 0, 0.7) !important;
  animation: none !important;
}

/* ── TABS — MATRIX TERMINAL STYLE ────────────────────────────────────── */
.saas-tab-strip {
  background: rgba(1, 8, 3, 0.85) !important;
  border: 1px solid rgba(0, 255, 136, 0.15) !important;
  border-radius: 8px !important;
  padding: 4px !important;
  gap: 4px !important;
  border-bottom: 1px solid rgba(0, 255, 136, 0.15) !important;
  margin-bottom: 24px !important;
}

.saas-tab-item {
  font-family: 'Share Tech Mono', monospace !important;
  font-size: 11px !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  border-bottom: none !important;
  margin-bottom: 0 !important;
  border-radius: 5px !important;
  color: rgba(0, 200, 100, 0.5) !important;
}

.saas-tab-item:hover {
  color: #00ff88 !important;
  background: rgba(0, 255, 136, 0.06) !important;
}

.saas-tab-item.active {
  background: rgba(0, 255, 136, 0.1) !important;
  color: #00ff88 !important;
  border: 1px solid rgba(0, 255, 136, 0.3) !important;
  border-bottom: 1px solid rgba(0, 255, 136, 0.3) !important;
  font-weight: 700 !important;
  text-shadow: 0 0 12px rgba(0, 255, 136, 0.8), 0 0 24px rgba(0, 255, 136, 0.3) !important;
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.15) !important;
}

/* ── QUANTUM BUTTONS ─────────────────────────────────────────────────── */
.btn-solid-white {
  background: linear-gradient(135deg, #00ff88 0%, #10b981 100%) !important;
  color: #000802 !important;
  font-family: 'Exo 2', sans-serif !important;
  font-weight: 800 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  border: none !important;
  border-radius: 6px !important;
  box-shadow:
    0 0 25px rgba(0, 255, 136, 0.5),
    0 0 50px rgba(0, 255, 136, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}
.btn-solid-white:hover:not(:disabled) {
  box-shadow:
    0 0 40px rgba(0, 255, 136, 0.8),
    0 0 80px rgba(0, 255, 136, 0.3) !important;
  transform: scale(1.04) !important;
}

.btn-secondary-dark {
  background: rgba(2, 10, 4, 0.8) !important;
  border: 1px solid rgba(0, 255, 136, 0.28) !important;
  color: #00ff88 !important;
  font-family: 'Share Tech Mono', monospace !important;
  border-radius: 6px !important;
}
.btn-secondary-dark:hover:not(:disabled) {
  background: rgba(0, 255, 136, 0.08) !important;
  border-color: #00ff88 !important;
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.3) !important;
}

/* ── RADIOACTIVE PROGRESS ────────────────────────────────────────────── */
.progress-fill {
  background: linear-gradient(90deg, #10b981 0%, #00ff88 50%, #34d399 100%) !important;
  box-shadow: 0 0 16px rgba(0, 255, 136, 0.75), 0 0 32px rgba(0, 255, 136, 0.3) !important;
}

/* ── PHOSPHOR TERMINAL ───────────────────────────────────────────────── */
pre {
  background: rgba(0, 5, 2, 0.97) !important;
  border: 1px solid rgba(0, 255, 136, 0.2) !important;
  border-radius: 8px !important;
  box-shadow:
    0 0 40px rgba(0, 0, 0, 0.95),
    inset 0 0 30px rgba(0, 255, 136, 0.04) !important;
}

pre span, pre * {
  color: #00ff88 !important;
  text-shadow: 0 0 8px rgba(0, 255, 136, 0.6) !important;
}

/* ── STATUS DOTS ─────────────────────────────────────────────────────── */
.dot-online {
  background: #00ff88 !important;
  box-shadow: 0 0 10px #00ff88, 0 0 22px rgba(0, 255, 136, 0.6) !important;
}

.status-pill {
  background: rgba(2, 10, 4, 0.8) !important;
  border: 1px solid rgba(0, 255, 136, 0.2) !important;
  font-family: 'Share Tech Mono', monospace !important;
}

/* ── INPUTS ──────────────────────────────────────────────────────────── */
.saas-input, input, textarea, select {
  background: rgba(1, 7, 3, 0.9) !important;
  border: 1px solid rgba(0, 255, 136, 0.2) !important;
  border-radius: 6px !important;
  color: #c0f0d4 !important;
  font-family: 'Share Tech Mono', monospace !important;
}
.saas-input:focus, input:focus, textarea:focus {
  border-color: #00ff88 !important;
  box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2), 0 0 20px rgba(0, 255, 136, 0.1) !important;
}

/* ── MODAL BOX ───────────────────────────────────────────────────────── */
.saas-modal-box {
  background: #010802 !important;
  border: 1px solid rgba(0, 255, 136, 0.25) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 60px rgba(0, 255, 136, 0.12), 0 40px 80px rgba(0, 0, 0, 0.9) !important;
}

/* ── SCROLLBAR ───────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 136, 0.3);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: #00ff88;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
}`
  }
];
