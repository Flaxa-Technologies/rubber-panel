import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import { compareMinecraftVersions } from "@/lib/minecraft-versions";

interface SoftwareDef {
  name: string;
  type: string;
  description: string;
  logoUrl?: string;
}

interface VersionDef {
  version: string;
  isStable?: boolean;
}

async function upsertSoftwareWithVersions(softwareDef: SoftwareDef, versions: VersionDef[]) {
  let soft = await db.software.findFirst({ where: { name: softwareDef.name } });
  if (!soft) {
    soft = await db.software.create({ data: softwareDef });
  } else {
    // Update description and logo if needed
    await db.software.update({
      where: { id: soft.id },
      data: {
        description: softwareDef.description,
        logoUrl: softwareDef.logoUrl || soft.logoUrl,
        type: softwareDef.type,
      },
    });
  }

  // Deduplicate and filter empty versions
  const map = new Map<string, boolean>();
  for (const v of versions) {
    if (!v.version || !v.version.trim()) continue;
    const ver = v.version.trim();
    if (!map.has(ver) || v.isStable) {
      map.set(ver, v.isStable ?? true);
    }
  }

  for (const [ver, isStable] of map.entries()) {
    await db.softwareVersion.upsert({
      where: { softwareId_version: { softwareId: soft.id, version: ver } },
      update: { isStable },
      create: { softwareId: soft.id, version: ver, isStable },
    });
  }
  return soft;
}

// Safe JSON fetch with timeout & user-agent
async function safeFetch(url: string, timeoutMs = 9000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "RubberPanel/2.0 (Minecraft Server Manager)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const isInternal = Boolean(internalSecret && expectedSecret && internalSecret === expectedSecret);

  const session = await getServerSession(authOptions);
  if (!isInternal && (!session?.user || !isAdminRole((session.user as any).role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const results: Record<string, number> = {};

    // ─── 1. Paper – live from official PaperMC API v3 ────────────────────────
    {
      let paperVersions: VersionDef[] = [];
      const paperData = await safeFetch("https://fill.papermc.io/v3/projects/paper");
      if (paperData?.versions && typeof paperData.versions === "object") {
        const rawList: string[] = [];
        for (const group of Object.values(paperData.versions)) {
          if (Array.isArray(group)) {
            for (const v of group) {
              if (typeof v === "string") rawList.push(v);
            }
          }
        }
        paperVersions = rawList.map(v => {
          const isPre = /-rc|-pre|-snapshot|-beta|-alpha/i.test(v);
          return { version: v, isStable: !isPre };
        });
      }

      if (paperVersions.length === 0) {
        paperVersions = [
          "26.2","26.1.2","26.1.1","1.21.11","1.21.4","1.21.3","1.21.1","1.21",
          "1.20.6","1.20.4","1.20.2","1.20.1","1.20",
          "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
          "1.18.2","1.18.1","1.18","1.17.1","1.17",
          "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1",
          "1.15.2","1.15.1","1.15","1.14.4","1.14.3","1.14.2","1.14.1","1.14",
          "1.13.2","1.13.1","1.13","1.12.2","1.12.1","1.12",
          "1.11.2","1.11","1.10.2","1.9.4","1.8.8","1.7.10",
        ].map(v => ({ version: v, isStable: true }));
      }

      await upsertSoftwareWithVersions(
        {
          name: "Paper",
          type: "PAPER",
          description: "High-performance Minecraft server — most popular for plugins & optimized TPS",
          logoUrl: "https://papermc.io/favicon.ico",
        },
        paperVersions
      );
      results["Paper"] = paperVersions.length;
    }

    // ─── 2. Purpur – live from Purpur API ────────────────────────────────────
    {
      let purpurVersions: VersionDef[] = [];
      const purpurData = await safeFetch("https://api.purpurmc.org/v2/purpur");
      if (purpurData?.versions && Array.isArray(purpurData.versions)) {
        purpurVersions = purpurData.versions.map((v: string) => ({
          version: v,
          isStable: !/-rc|-pre|-snapshot/i.test(v),
        }));
      }
      if (purpurVersions.length === 0) {
        purpurVersions = [
          "26.2","26.1.2","1.21.4","1.21.3","1.21.1","1.21",
          "1.20.6","1.20.4","1.20.2","1.20.1",
          "1.19.4","1.19.2","1.18.2","1.17.1","1.16.5","1.16.4",
          "1.15.2","1.14.4","1.13.2","1.12.2",
        ].map(v => ({ version: v, isStable: true }));
      }
      await upsertSoftwareWithVersions(
        {
          name: "Purpur",
          type: "PURPUR",
          description: "Paper fork with extra gameplay configuration options and quality-of-life patches",
          logoUrl: "https://purpurmc.org/favicon.ico",
        },
        purpurVersions
      );
      results["Purpur"] = purpurVersions.length;
    }

    // ─── 3. Vanilla – live from Mojang ───────────────────────────────────────
    {
      let vanillaVersions: VersionDef[] = [];
      const mojang = await safeFetch("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
      if (mojang?.versions && Array.isArray(mojang.versions)) {
        vanillaVersions = mojang.versions.map((v: any) => ({
          version: v.id,
          isStable: v.type === "release",
        }));
      }
      if (vanillaVersions.length === 0) {
        vanillaVersions = [
          "26.2","26.1.2","1.21.5","1.21.4","1.21.3","1.21.2","1.21.1","1.21",
          "1.20.6","1.20.5","1.20.4","1.20.2","1.20.1","1.20",
          "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
          "1.18.2","1.18.1","1.18","1.17.1","1.17",
          "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1",
          "1.15.2","1.15.1","1.15","1.14.4","1.13.2","1.12.2","1.11.2","1.10.2","1.9.4","1.8.8","1.7.10",
        ].map(v => ({ version: v, isStable: true }));
      }
      await upsertSoftwareWithVersions(
        {
          name: "Vanilla",
          type: "VANILLA",
          description: "Standard official Mojang Minecraft Java Edition server",
          logoUrl: "https://minecraft.wiki/images/Grass_Block.png",
        },
        vanillaVersions
      );
      results["Vanilla"] = vanillaVersions.length;
    }

    // ─── 4. Fabric (Modded) – live from Fabric Meta API ───────────────────────
    {
      let fabricVersions: VersionDef[] = [];
      const fabricData = await safeFetch("https://meta.fabricmc.net/v2/versions/game");
      if (fabricData && Array.isArray(fabricData)) {
        fabricVersions = fabricData.map((v: any) => ({
          version: v.version,
          isStable: Boolean(v.stable),
        }));
      }
      if (fabricVersions.length === 0) {
        fabricVersions = [
          "26.2","26.1.2","1.21.4","1.21.3","1.21.2","1.21.1","1.21",
          "1.20.6","1.20.5","1.20.4","1.20.3","1.20.2","1.20.1","1.20",
          "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
          "1.18.2","1.18.1","1.18","1.17.1","1.17",
          "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1",
          "1.15.2","1.15.1","1.15","1.14.4","1.13.2","1.12.2","1.8.8",
        ].map(v => ({ version: v, isStable: true }));
      }
      await upsertSoftwareWithVersions(
        {
          name: "Fabric",
          type: "FABRIC",
          description: "Lightweight, modular mod loader — popular for cutting-edge mods & performance optimizations",
          logoUrl: "https://fabricmc.net/favicon.ico",
        },
        fabricVersions
      );
      results["Fabric"] = fabricVersions.length;
    }

    // ─── 5. Quilt (Modded) – live from Quilt Meta API ────────────────────────
    {
      let quiltVersions: VersionDef[] = [];
      const quiltData = await safeFetch("https://meta.quiltmc.org/v3/versions/game");
      if (quiltData && Array.isArray(quiltData)) {
        quiltVersions = quiltData.map((v: any) => ({
          version: v.version,
          isStable: Boolean(v.stable),
        }));
      }
      if (quiltVersions.length === 0) {
        quiltVersions = [
          "1.21.4","1.21.3","1.21.1","1.21","1.20.6","1.20.4","1.20.2","1.20.1","1.20",
          "1.19.4","1.19.3","1.19.2","1.19.1","1.19","1.18.2","1.17.1","1.16.5","1.15.2","1.14.4",
        ].map(v => ({ version: v, isStable: true }));
      }
      await upsertSoftwareWithVersions(
        {
          name: "Quilt",
          type: "QUILT",
          description: "Community-driven modular mod loader compatible with Fabric mods and modern APIs",
          logoUrl: "https://quiltmc.org/favicon.ico",
        },
        quiltVersions
      );
      results["Quilt"] = quiltVersions.length;
    }

    // ─── 6. NeoForge (Modded) – live from NeoForge Maven ─────────────────────
    {
      let neoVersions: VersionDef[] = [];
      const neoData = await safeFetch("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge");
      if (neoData?.versions && Array.isArray(neoData.versions)) {
        const seen = new Set<string>();
        for (const raw of neoData.versions) {
          const clean = (raw as string).split("-")[0];
          const parts = clean.split(".");
          if (parts.length >= 2) {
            const mcVer = parts[0] === "20" || parts[0] === "21" ? `1.${parts[0]}.${parts[1]}` : parts.slice(0, 2).join(".");
            if (!seen.has(mcVer)) {
              seen.add(mcVer);
              neoVersions.push({ version: mcVer, isStable: true });
            }
          }
        }
      }
      if (neoVersions.length === 0) {
        neoVersions = [
          "1.21.4","1.21.3","1.21.1","1.21","1.20.6","1.20.4","1.20.2","1.20.1",
        ].map(v => ({ version: v, isStable: true }));
      }
      await upsertSoftwareWithVersions(
        {
          name: "NeoForge",
          type: "FORGE",
          description: "Modern community-maintained Forge fork — high performance & rich mod ecosystem",
          logoUrl: "https://neoforged.net/favicon.ico",
        },
        neoVersions
      );
      results["NeoForge"] = neoVersions.length;
    }

    // ─── 7. Forge (Modded) ───────────────────────────────────────────────────
    {
      const forgeVersions = [
        "1.21.4","1.21.3","1.21.1","1.21",
        "1.20.6","1.20.5","1.20.4","1.20.3","1.20.2","1.20.1","1.20",
        "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
        "1.18.2","1.18.1","1.18",
        "1.17.1","1.17",
        "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1",
        "1.15.2","1.15.1","1.15",
        "1.14.4","1.14.3","1.14.2",
        "1.13.2",
        "1.12.2","1.12.1","1.12",
        "1.11.2","1.11",
        "1.10.2","1.10",
        "1.9.4","1.9",
        "1.8.9","1.8.8","1.8",
        "1.7.10","1.7.2",
        "1.6.4","1.5.2",
      ].map(v => ({ version: v, isStable: true }));

      await upsertSoftwareWithVersions(
        {
          name: "Forge",
          type: "FORGE",
          description: "Classic mod loader with extensive modding API — tens of thousands of mods and modpacks available",
          logoUrl: "https://minecraftforge.net/favicon.ico",
        },
        forgeVersions
      );
      results["Forge"] = forgeVersions.length;
    }

    // ─── 8. Mohist (Hybrid: Forge + Paper/Plugins) ───────────────────────────
    {
      const mohistVersions = [
        "1.20.4","1.20.2","1.20.1","1.19.4","1.19.2","1.18.2","1.16.5","1.12.2","1.7.10",
      ].map(v => ({ version: v, isStable: true }));

      await upsertSoftwareWithVersions(
        {
          name: "Mohist (Hybrid)",
          type: "MOHIST",
          description: "Hybrid server software allowing both Forge mods and Bukkit/Spigot/Paper plugins simultaneously",
          logoUrl: "https://mohistmc.com/favicon.ico",
        },
        mohistVersions
      );
      results["Mohist"] = mohistVersions.length;
    }

    // ─── 9. Arclight (Hybrid: Forge/Fabric + Paper) ───────────────────────────
    {
      const arclightVersions = [
        "1.21.4","1.21.1","1.20.4","1.20.2","1.20.1","1.19.4","1.19.2","1.18.2","1.16.5","1.15.2","1.14.4",
      ].map(v => ({ version: v, isStable: true }));

      await upsertSoftwareWithVersions(
        {
          name: "Arclight (Hybrid)",
          type: "ARCLIGHT",
          description: "High-performance hybrid server implementation for Forge, NeoForge & Fabric with Bukkit plugin compatibility",
        },
        arclightVersions
      );
      results["Arclight"] = arclightVersions.length;
    }

    // ─── 10. Spigot ──────────────────────────────────────────────────────────
    {
      const spigotVersions = [
        "1.21.4","1.21.3","1.21.1","1.21",
        "1.20.6","1.20.5","1.20.4","1.20.2","1.20.1","1.20",
        "1.19.4","1.19.3","1.19.2","1.19.1","1.19",
        "1.18.2","1.18.1","1.18",
        "1.17.1","1.17",
        "1.16.5","1.16.4","1.16.3","1.16.2","1.16.1",
        "1.15.2","1.15.1","1.15",
        "1.14.4","1.14.3","1.14.2","1.14.1","1.14",
        "1.13.2","1.13.1","1.13",
        "1.12.2","1.12.1","1.12",
        "1.11.2","1.11.1","1.11",
        "1.10.2",
        "1.9.4","1.9.2",
        "1.8.8","1.8.3","1.8",
      ].map(v => ({ version: v, isStable: true }));

      await upsertSoftwareWithVersions(
        {
          name: "Spigot",
          type: "SPIGOT",
          description: "Bukkit fork with performance improvements and the standard Spigot plugin API",
          logoUrl: "https://www.spigotmc.org/favicon.ico",
        },
        spigotVersions
      );
      results["Spigot"] = spigotVersions.length;
    }

    // ─── 11. Velocity – live from PaperMC API ────────────────────────────────
    {
      let velocityVersions: VersionDef[] = [];
      const velData = await safeFetch("https://fill.papermc.io/v3/projects/velocity");
      if (velData?.versions && typeof velData.versions === "object") {
        const rawList: string[] = [];
        for (const group of Object.values(velData.versions)) {
          if (Array.isArray(group)) {
            for (const v of group) {
              if (typeof v === "string") rawList.push(v);
            }
          }
        }
        velocityVersions = rawList.map(v => ({
          version: v,
          isStable: !/-SNAPSHOT|-beta|-alpha/i.test(v),
        }));
      }
      if (velocityVersions.length === 0) {
        velocityVersions = [
          { version: "3.4.0", isStable: true },
          { version: "3.3.0", isStable: true },
          { version: "3.2.0", isStable: true },
          { version: "3.1.2", isStable: true },
          { version: "3.1.1", isStable: true },
          { version: "3.1.0", isStable: true },
          { version: "1.1.9", isStable: true },
        ];
      }
      await upsertSoftwareWithVersions(
        {
          name: "Velocity",
          type: "VELOCITY",
          description: "Modern next-gen high-performance Minecraft proxy by PaperMC",
          logoUrl: "https://papermc.io/favicon.ico",
        },
        velocityVersions
      );
      results["Velocity"] = velocityVersions.length;
    }

    // ─── 12. Waterfall – live from PaperMC API ───────────────────────────────
    {
      let waterfallVersions: VersionDef[] = [];
      const wfData = await safeFetch("https://fill.papermc.io/v3/projects/waterfall");
      if (wfData?.versions && typeof wfData.versions === "object") {
        const rawList: string[] = [];
        for (const group of Object.values(wfData.versions)) {
          if (Array.isArray(group)) {
            for (const v of group) {
              if (typeof v === "string") rawList.push(v);
            }
          }
        }
        waterfallVersions = rawList.map(v => ({ version: v, isStable: true }));
      }
      if (waterfallVersions.length === 0) {
        waterfallVersions = ["1.21","1.20","1.19","1.18","1.17","1.16","1.15","1.14","1.13","1.12","1.11"].map(v => ({ version: v, isStable: true }));
      }
      await upsertSoftwareWithVersions(
        {
          name: "Waterfall",
          type: "BUNGEECORD",
          description: "BungeeCord fork by PaperMC with extra performance and API improvements",
          logoUrl: "https://papermc.io/favicon.ico",
        },
        waterfallVersions
      );
      results["Waterfall"] = waterfallVersions.length;
    }

    // ─── 13. Folia – live from PaperMC API ──────────────────────────────────
    {
      let foliaVersions: VersionDef[] = [];
      const foliaData = await safeFetch("https://fill.papermc.io/v3/projects/folia");
      if (foliaData?.versions && typeof foliaData.versions === "object") {
        const rawList: string[] = [];
        for (const group of Object.values(foliaData.versions)) {
          if (Array.isArray(group)) {
            for (const v of group) {
              if (typeof v === "string") rawList.push(v);
            }
          }
        }
        foliaVersions = rawList.map(v => ({ version: v, isStable: !/-rc|-pre|-snapshot/i.test(v) }));
      }
      if (foliaVersions.length > 0) {
        await upsertSoftwareWithVersions(
          {
            name: "Folia",
            type: "PAPER",
            description: "Paper fork that adds regionised multithreading to the dedicated server",
            logoUrl: "https://papermc.io/favicon.ico",
          },
          foliaVersions
        );
        results["Folia"] = foliaVersions.length;
      }
    }

    // ─── 14. BungeeCord ─────────────────────────────────────────────────────
    {
      const bungeeVersions = [
        "1.21","1.20","1.19","1.18","1.17","1.16","1.15","1.14","1.13","1.12","1.11","1.10","1.9","1.8",
      ].map(v => ({ version: v, isStable: true }));

      await upsertSoftwareWithVersions(
        {
          name: "BungeeCord",
          type: "BUNGEECORD",
          description: "Proxy server to connect multiple Minecraft servers into one network",
          logoUrl: "https://www.spigotmc.org/favicon.ico",
        },
        bungeeVersions
      );
      results["BungeeCord"] = bungeeVersions.length;
    }

    // ─── 15. Geyser (Standalone) ────────────────────────────────────────────
    {
      const geyserVersions = [
        { version: "2.5.1", isStable: true },
        { version: "2.5.0", isStable: true },
        { version: "2.4.2", isStable: true },
        { version: "2.4.0", isStable: true },
        { version: "2.3.0", isStable: true },
      ];
      await upsertSoftwareWithVersions(
        {
          name: "Geyser (Standalone)",
          type: "CUSTOM",
          description: "Allow Bedrock Edition players to join Java servers",
        },
        geyserVersions
      );
      results["Geyser"] = geyserVersions.length;
    }

    return NextResponse.json({ success: true, versions: results });
  } catch (error: any) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Sync failed", details: error.message }, { status: 500 });
  }
}
