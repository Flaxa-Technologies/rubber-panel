import db from "./db";

// Default settings
const DEFAULTS: Record<string, string> = {
  // Authentication
  "auth.registrationEnabled": "true",
  "auth.emailVerification": "false",
  "auth.sessionDurationHours": "24",
  "auth.maxLoginAttempts": "5",
  "auth.loginRateLimitMinutes": "15",

  // Security
  "security.apiRateLimit": "100",
  "security.requireStrongPasswords": "true",
  "security.minPasswordLength": "8",

  // Server defaults
  "server.defaultRamMb": "1024",
  "server.defaultCpuPercent": "100",
  "server.defaultDiskMb": "5120",
  "server.maxBackupsPerServer": "10",

  // Node
  "node.heartbeatIntervalSeconds": "30",
  "node.offlineTimeoutSeconds": "90",

  // Branding & User Customization
  "branding.siteName": "Rubber Panel",
  "branding.siteDescription": "Next-Generation Game Server Platform",
  "branding.logoUrl": "/logo.png",
  "branding.faviconUrl": "/favicon.ico",
  "branding.footerText": "Powered by Rubber Panel",
  "branding.themePreset": "onyx",
  "branding.accentColor": "#ffffff",
  "branding.navbarStyle": "blur",
  "branding.customCss": "",

  // Social & Community Links
  "social.discord": "https://discord.gg/rubberpanel",
  "social.youtube": "",
  "social.instagram": "",
  "social.twitter": "",
  "social.website": "https://hostadmin.net",
  "social.supportUrl": "https://discord.gg/rubberpanel",
  "social.customLinks": "[]",

  // User Panel Features & CTAs
  "features.showDiscordButton": "true",
  "features.suspendedDiscordCta": "true",
  "features.announcementEnabled": "false",
  "features.announcementTitle": "Welcome to Rubber Panel",
  "features.announcementMessage": "Join our official community on Discord for instant assistance and updates!",

  // Cryo-Sleep (0-RAM Hibernation & Auto Wake-on-Ping)
  "cryosleep.defaultEnabled": "false",
  "cryosleep.defaultIdleMinutes": "10",
  "cryosleep.defaultMotd": "§bRubber Panel §8| §3Server is in Cryo-Sleep\\n§e§lClick to Connect & Auto-Wake Instance!",
  "cryosleep.wakeMessage": "§b§lRubber Panel §8— §3§lCRYO-SLEEP WAKE-UP\\n\\n§aServer wake sequence initiated!\\n§7The instance is now booting from hibernation.\\n\\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)",
  "cryosleep.autoConfigureNewNodes": "true",
  "cryosleep.allowUserCustomMotd": "true",

  // Custom Subdomains (Individual SRV Records)
  "domains.defaultPerServer": "1",
  "domains.allowSubdomains": "true",
  "domains.reservedPrefixes": "[\"admin\",\"panel\",\"node\",\"api\",\"mail\",\"smtp\",\"ftp\",\"ssh\",\"ns1\",\"ns2\",\"www\",\"dev\",\"status\"]",

  // Status Page Management
  "status_page.enabled": "true",
  "status_page.title": "Rubber Panel System Status",
  "status_page.description": "Real-time service health, cluster metrics, and node heartbeat operational state.",
  "status_page.include_admin": "true",
  "status_page.include_user": "true",
  "status_page.included_node_ids": "ALL",
  "status_page.custom_message": "",
  "status_page.notice_type": "info",
  "status_page.show_notice": "false",
  "status_page.theme_accent": "lime",
  "status_page.company_name": "Flaxa Studios",
  "status_page.support_url": "https://discord.gg/rubberpanel",
};

export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.setting.findUnique({ where: { key } });
  if (setting) return setting.value;
  return DEFAULTS[key] ?? null;
}

export async function getSettingBool(key: string): Promise<boolean> {
  const val = await getSetting(key);
  return val === "true";
}

export async function getSettingInt(key: string): Promise<number> {
  const val = await getSetting(key);
  return val ? parseInt(val, 10) : 0;
}

export async function setSetting(
  key: string,
  value: string,
  group = "general"
): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value, group },
    create: { key, value, group },
  });
}

export async function getSettingsGroup(
  group: string
): Promise<Record<string, string>> {
  const settings = await db.setting.findMany({ where: { group } });
  const result: Record<string, string> = {};

  // Populate with defaults first
  for (const [key, val] of Object.entries(DEFAULTS)) {
    const settingGroup = key.split(".")[0];
    if (settingGroup === group) {
      result[key] = val;
    }
  }

  // Override with DB values
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return result;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await db.setting.findMany();
  const result = { ...DEFAULTS };
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return result;
}

export async function getPublicCustomization(): Promise<Record<string, string>> {
  const all = await getAllSettings();
  const publicKeys = [
    "branding.siteName",
    "branding.siteDescription",
    "branding.logoUrl",
    "branding.faviconUrl",
    "branding.footerText",
    "branding.themePreset",
    "branding.accentColor",
    "branding.navbarStyle",
    "branding.customCss",
    "social.discord",
    "social.youtube",
    "social.instagram",
    "social.twitter",
    "social.website",
    "social.supportUrl",
    "social.customLinks",
    "features.showDiscordButton",
    "features.suspendedDiscordCta",
    "features.announcementEnabled",
    "features.announcementTitle",
    "features.announcementMessage",
  ];
  const pub: Record<string, string> = {};
  for (const k of publicKeys) {
    pub[k] = all[k] ?? "";
  }
  return pub;
}

export function isRegistrationEnabled(settings: Record<string, string>): boolean {
  return settings["auth.registrationEnabled"] === "true";
}
