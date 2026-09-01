"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export interface CustomLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}

export interface CustomizationData {
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  footerText: string;
  themePreset: string;
  accentColor: string;
  navbarStyle: string;
  customCss: string;
  discord: string;
  youtube: string;
  instagram: string;
  twitter: string;
  website: string;
  supportUrl: string;
  customLinks: CustomLink[];
  showDiscordButton: boolean;
  suspendedDiscordCta: boolean;
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementMessage: string;
}

const defaultCustomization: CustomizationData = {
  siteName: "Rubber Panel",
  siteDescription: "Next-Generation Game Server Platform",
  logoUrl: "/logo.png",
  footerText: "Powered by Rubber Panel",
  themePreset: "onyx",
  accentColor: "#ffffff",
  navbarStyle: "blur",
  customCss: "",
  discord: "https://discord.gg/rubberpanel",
  youtube: "",
  instagram: "",
  twitter: "",
  website: "https://hostadmin.net",
  supportUrl: "https://discord.gg/rubberpanel",
  customLinks: [],
  showDiscordButton: true,
  suspendedDiscordCta: true,
  announcementEnabled: false,
  announcementTitle: "",
  announcementMessage: "",
};

const THEME_PALETTES: Record<string, Record<string, string>> = {
  onyx: {
    "--bg-app": "#000000",
    "--bg-surface": "#09090b",
    "--bg-surface-elevated": "#121215",
    "--bg-surface-hover": "#18181b",
    "--bg-input": "#0e0e11",
    "--border-subtle": "#1c1c20",
    "--border-medium": "#27272a",
    "--border-active": "#3f3f46",
    "--border-white": "rgba(255, 255, 255, 0.15)",
    "--accent-dynamic": "#ffffff",
    "--accent-glow": "rgba(255, 255, 255, 0.08)",
  },
  midnight: {
    "--bg-app": "#060911",
    "--bg-surface": "#0a0f1d",
    "--bg-surface-elevated": "#10172c",
    "--bg-surface-hover": "#16203c",
    "--bg-input": "#0b1224",
    "--border-subtle": "#131c33",
    "--border-medium": "#1e2945",
    "--border-active": "#38bdf8",
    "--border-white": "rgba(56, 189, 248, 0.2)",
    "--accent-dynamic": "#38bdf8",
    "--accent-glow": "rgba(56, 189, 248, 0.12)",
  },
  emerald: {
    "--bg-app": "#030a05",
    "--bg-surface": "#06140a",
    "--bg-surface-elevated": "#0c2413",
    "--bg-surface-hover": "#11331b",
    "--bg-input": "#081a0d",
    "--border-subtle": "#0f3019",
    "--border-medium": "#174725",
    "--border-active": "#10b981",
    "--border-white": "rgba(16, 185, 129, 0.2)",
    "--accent-dynamic": "#10b981",
    "--accent-glow": "rgba(16, 185, 129, 0.12)",
  },
  purple: {
    "--bg-app": "#07040f",
    "--bg-surface": "#0e081e",
    "--bg-surface-elevated": "#180e33",
    "--bg-surface-hover": "#221447",
    "--bg-input": "#120a27",
    "--border-subtle": "#23144a",
    "--border-medium": "#3b227d",
    "--border-active": "#a855f7",
    "--border-white": "rgba(168, 85, 247, 0.2)",
    "--accent-dynamic": "#a855f7",
    "--accent-glow": "rgba(168, 85, 247, 0.12)",
  },
  crimson: {
    "--bg-app": "#0d0407",
    "--bg-surface": "#17070c",
    "--bg-surface-elevated": "#260c14",
    "--bg-surface-hover": "#36111d",
    "--bg-input": "#1e0910",
    "--border-subtle": "#3d1421",
    "--border-medium": "#5e1f33",
    "--border-active": "#f43f5e",
    "--border-white": "rgba(244, 63, 94, 0.2)",
    "--accent-dynamic": "#f43f5e",
    "--accent-glow": "rgba(244, 63, 94, 0.12)",
  },
  amber: {
    "--bg-app": "#0c0803",
    "--bg-surface": "#140d05",
    "--bg-surface-elevated": "#221708",
    "--bg-surface-hover": "#30210b",
    "--bg-input": "#1a1206",
    "--border-subtle": "#36250d",
    "--border-medium": "#543914",
    "--border-active": "#f59e0b",
    "--border-white": "rgba(245, 158, 11, 0.2)",
    "--accent-dynamic": "#f59e0b",
    "--accent-glow": "rgba(245, 158, 11, 0.12)",
  },
};

const CustomizationContext = createContext<CustomizationData>(defaultCustomization);

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CustomizationData>(defaultCustomization);

  const fetchCustomization = useCallback(async () => {
    try {
      const res = await fetch("/api/user/customization");
      if (res.ok) {
        const json = await res.json();
        const raw = json.customization || {};

        let links: CustomLink[] = [];
        try {
          links = JSON.parse(raw["social.customLinks"] || "[]");
        } catch { }

        setData({
          siteName: raw["branding.siteName"] || defaultCustomization.siteName,
          siteDescription: raw["branding.siteDescription"] || defaultCustomization.siteDescription,
          logoUrl: raw["branding.logoUrl"] || defaultCustomization.logoUrl,
          footerText: raw["branding.footerText"] || defaultCustomization.footerText,
          themePreset: raw["branding.themePreset"] || defaultCustomization.themePreset,
          accentColor: raw["branding.accentColor"] || defaultCustomization.accentColor,
          navbarStyle: raw["branding.navbarStyle"] || defaultCustomization.navbarStyle,
          customCss: raw["branding.customCss"] || "",
          discord: raw["social.discord"] || "",
          youtube: raw["social.youtube"] || "",
          instagram: raw["social.instagram"] || "",
          twitter: raw["social.twitter"] || "",
          website: raw["social.website"] || "",
          supportUrl: raw["social.supportUrl"] || raw["social.discord"] || "",
          customLinks: Array.isArray(links) ? links : [],
          showDiscordButton: raw["features.showDiscordButton"] === "true",
          suspendedDiscordCta: raw["features.suspendedDiscordCta"] !== "false",
          announcementEnabled: raw["features.announcementEnabled"] === "true",
          announcementTitle: raw["features.announcementTitle"] || "",
          announcementMessage: raw["features.announcementMessage"] || "",
        });
      }
    } catch { }
  }, []);

  useEffect(() => {
    fetchCustomization();
    const interval = setInterval(fetchCustomization, 2500);
    return () => clearInterval(interval);
  }, [fetchCustomization]);

  // Apply Theme CSS variables to :root
  useEffect(() => {
    const root = document.documentElement;
    const preset = THEME_PALETTES[data.themePreset] || THEME_PALETTES.onyx;

    // Apply palette tokens
    for (const [key, value] of Object.entries(preset)) {
      root.style.setProperty(key, value);
    }

    // Override accent color if custom
    if (data.accentColor) {
      root.style.setProperty("--accent-dynamic", data.accentColor);
    }

    // Navbar style
    if (data.navbarStyle === "blur") {
      root.style.setProperty("--navbar-backdrop", "blur(14px)");
      root.style.setProperty("--navbar-bg", "rgba(9, 9, 11, 0.75)");
    } else if (data.navbarStyle === "solid") {
      root.style.setProperty("--navbar-backdrop", "none");
      root.style.setProperty("--navbar-bg", "var(--bg-surface)");
    } else {
      root.style.setProperty("--navbar-backdrop", "none");
      root.style.setProperty("--navbar-bg", "transparent");
    }
  }, [data.themePreset, data.accentColor, data.navbarStyle]);

  // Apply custom CSS dynamically
  useEffect(() => {
    let styleTag = document.getElementById("rp-dynamic-custom-css") as HTMLStyleElement | null;
    if (data.customCss) {
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "rp-dynamic-custom-css";
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = data.customCss;
    } else if (styleTag) {
      styleTag.remove();
    }
  }, [data.customCss]);

  return (
    <CustomizationContext.Provider value={data}>
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomization() {
  return useContext(CustomizationContext);
}
