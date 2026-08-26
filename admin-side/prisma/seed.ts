import "dotenv/config";
import { PrismaClient } from "@prisma/client";

import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Rubber Panel database...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@rubberlab.net";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "superadmin";

  const existing = await db.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await db.user.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    console.log(`✅ Created Super Admin: ${admin.email}`);
  } else {
    console.log(`ℹ️  Super Admin already exists: ${adminEmail}`);
  }

  // Default settings
  const defaultSettings = [
    { key: "auth.registrationEnabled", value: "true", group: "auth" },
    { key: "auth.emailVerification", value: "false", group: "auth" },
    { key: "auth.sessionDurationHours", value: "24", group: "auth" },
    { key: "auth.maxLoginAttempts", value: "5", group: "auth" },
    { key: "security.requireStrongPasswords", value: "true", group: "security" },
    { key: "security.minPasswordLength", value: "8", group: "security" },
    { key: "security.apiRateLimit", value: "100", group: "security" },
    { key: "server.defaultRamMb", value: "1024", group: "server" },
    { key: "server.defaultCpuPercent", value: "100", group: "server" },
    { key: "server.defaultDiskMb", value: "5120", group: "server" },
    { key: "server.maxBackupsPerServer", value: "10", group: "server" },
    { key: "node.heartbeatIntervalSeconds", value: "30", group: "node" },
    { key: "node.offlineTimeoutSeconds", value: "90", group: "node" },
    { key: "branding.siteName", value: "Rubber Panel", group: "branding" },
    { key: "branding.siteDescription", value: "Professional Minecraft Hosting Management", group: "branding" },
    { key: "branding.accentColor", value: "#a3e635", group: "branding" },
  ];

  for (const s of defaultSettings) {
    await db.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log("✅ Default settings seeded");

  // Software
  const softwareList = [
    { name: "Paper", type: "PAPER" as const, description: "High-performance fork of Spigot" },
    { name: "Vanilla", type: "VANILLA" as const, description: "Official Minecraft server" },
    { name: "Fabric", type: "FABRIC" as const, description: "Lightweight modding platform" },
    { name: "Forge", type: "FORGE" as const, description: "Classic modding platform" },
    { name: "Purpur", type: "PURPUR" as const, description: "Fork of Paper with extra features" },
    { name: "BungeeCord", type: "BUNGEECORD" as const, description: "Proxy server" },
    { name: "Velocity", type: "VELOCITY" as const, description: "Modern proxy server" },
  ];

  for (const sw of softwareList) {
    const existingSw = await db.software.findUnique({ where: { name: sw.name } });
    if (!existingSw) {
      const software = await db.software.create({ data: sw });
      await db.softwareVersion.createMany({
        data: [
          { softwareId: software.id, version: "1.21.4", isStable: true },
          { softwareId: software.id, version: "1.20.6", isStable: true },
        ],
      });
    }
  }
  console.log("✅ Software seeded");

  // Default template
  const tmpl = await db.template.findFirst({ where: { name: "Default Paper Template" } });
  if (!tmpl) {
    await db.template.create({
      data: {
        name: "Default Paper Template",
        description: "Standard Paper server configuration",
        softwareType: "PAPER",
        startupCmd: "java -Xms{{RAM}}M -Xmx{{RAM}}M -jar server.jar nogui",
        defaultRam: 1024,
        defaultCpu: 100,
        defaultDisk: 5120,
        allowedPaths: JSON.stringify(["/plugins", "/config", "/world", "/world_nether", "/world_the_end", "/logs"]),
        protectedPaths: JSON.stringify(["/server.jar", "/start.sh", "/rubber-panel"]),
      },
    });
    console.log("Default template created");
  }

  console.log("\n[Seed] Seeding complete!");
  console.log(`\n[Credentials] Admin Login:`);
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   URL:      http://localhost:3000/login`);
  console.log(`\n[Notice] Please change the default password after first login!`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
