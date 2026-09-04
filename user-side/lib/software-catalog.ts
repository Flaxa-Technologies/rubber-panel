// ==============================================================================
// Rubber Panel — Software Catalog & Official Logos Registry
// ==============================================================================

export interface SoftwareCatalogItem {
  id: string;
  name: string;
  type: string;
  logo: string;
  description: string;
  tag: string;
  tagColor: string;
  defaultVersions: string[];
  features: string[];
}

export const SOFTWARE_CATALOG: SoftwareCatalogItem[] = [
  {
    id: "paper",
    name: "PaperMC",
    type: "PAPER",
    logo: "https://avatars.githubusercontent.com/u/7608950?s=200&v=4",
    description: "The most popular, high-performance Spigot fork with unbeatable TPS optimizations and rich plugin support.",
    tag: "Recommended",
    tagColor: "#38bdf8",
    defaultVersions: ["1.21.4", "1.21.3", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
    features: ["Aikar's Flags", "Optimized TPS", "Bukkit & Spigot Plugins", "Chunk Loading Engine"],
  },
  {
    id: "purpur",
    name: "Purpur",
    type: "PURPUR",
    logo: "https://purpurmc.org/images/purpur.svg",
    description: "Drop-in replacement for Paper featuring extensive gameplay configuration, rideable mobs, and TPS enhancements.",
    tag: "Configurable",
    tagColor: "#c084fc",
    defaultVersions: ["1.21.4", "1.21.3", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2"],
    features: ["Rideable Mobs", "High Performance", "Paper Compatible", "Extensive Config"],
  },
  {
    id: "pumpkin",
    name: "Pumpkin MC (Rust)",
    type: "PUMPKIN",
    logo: "https://raw.githubusercontent.com/Pumpkin-MC/Pumpkin/master/assets/logo.png",
    description: "Blazingly fast, multi-threaded Minecraft server written entirely in Rust. Crossplay with Java and Bedrock natively.",
    tag: "Rust Native",
    tagColor: "#f97316",
    defaultVersions: ["Nightly (Latest)", "0.1.0"],
    features: ["Zero-JVM Overhead", "Rust Multithreading", "Java & Bedrock Crossplay", "Sub-Millisecond Tick Times"],
  },
  {
    id: "fabric",
    name: "Fabric",
    type: "FABRIC",
    logo: "https://avatars.githubusercontent.com/u/45091763?s=200&v=4",
    description: "Lightweight, modular modding toolchain for Minecraft. Excellent for modern modpacks and optimization mods like Lithium & Sodium.",
    tag: "Modded",
    tagColor: "#eab308",
    defaultVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5"],
    features: ["Fast Launch", "Huge Modpack Ecosystem", "Lightweight Memory Footprint", "Modern Modding API"],
  },
  {
    id: "forge",
    name: "Minecraft Forge",
    type: "FORGE",
    logo: "https://avatars.githubusercontent.com/u/522144?s=200&v=4",
    description: "The classic modding platform for Minecraft with the largest library of deep transformation mods and tech modpacks.",
    tag: "Heavy Modpacks",
    tagColor: "#fb923c",
    defaultVersions: ["1.20.4", "1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2"],
    features: ["Massive Mod Library", "Tech & Magic Modpacks", "Deep API Compatibility"],
  },
  {
    id: "neoforge",
    name: "NeoForge",
    type: "NEOFORGE",
    logo: "https://avatars.githubusercontent.com/u/138128509?s=200&v=4",
    description: "Next-generation community-driven fork of Forge designed for modern Minecraft versions with cleaner APIs and stability.",
    tag: "Modern Mods",
    tagColor: "#ef4444",
    defaultVersions: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"],
    features: ["Refactored Architecture", "Rapid Bug Fixes", "Compatible with NeoForge Mods"],
  },
  {
    id: "spigot",
    name: "Spigot",
    type: "SPIGOT",
    logo: "https://static.spigotmc.org/img/spigot.png",
    description: "The foundation of modern plugin servers based on CraftBukkit. Compatible with thousands of classic Spigot plugins.",
    tag: "Classic",
    tagColor: "#f59e0b",
    defaultVersions: ["1.21.4", "1.21.1", "1.20.4", "1.19.4", "1.18.2", "1.16.5", "1.12.2", "1.8.8"],
    features: ["Bukkit Ecosystem", "Classic Compatibility", "Plugin Support"],
  },
  {
    id: "vanilla",
    name: "Vanilla Minecraft",
    type: "VANILLA",
    logo: "https://launchercontent.mojang.com/icons/minecraft.png",
    description: "The authentic, official Mojang Minecraft Java Edition server without modifications or plugins.",
    tag: "Official",
    tagColor: "#22c55e",
    defaultVersions: ["1.21.4", "1.21.3", "1.21.1", "1.20.6", "1.20.4", "1.19.4", "1.18.2", "1.16.5"],
    features: ["100% Pure Mojang Mechanics", "Official Release", "No Plugin Overhead"],
  },
  {
    id: "velocity",
    name: "Velocity",
    type: "VELOCITY",
    logo: "https://avatars.githubusercontent.com/u/7608950?s=200&v=4",
    description: "Next-generation Minecraft proxy that links multiple servers into a unified network with DDoS resilience.",
    tag: "Proxy",
    tagColor: "#6366f1",
    defaultVersions: ["3.3.0", "3.2.0"],
    features: ["Server Networking", "Multi-Server Routing", "Modern Protocol Support"],
  },
  {
    id: "bungeecord",
    name: "BungeeCord",
    type: "BUNGEECORD",
    logo: "https://static.spigotmc.org/img/spigot.png",
    description: "Classic proxy software that lets players move seamlessly between multiple Spigot or Paper servers.",
    tag: "Network",
    tagColor: "#10b981",
    defaultVersions: ["Latest"],
    features: ["Multi-Server Network", "Lobby / Hub Support", "Classic Proxy"],
  },
  {
    id: "bedrock",
    name: "Bedrock Dedicated",
    type: "BEDROCK",
    logo: "https://launchercontent.mojang.com/icons/minecraft.png",
    description: "Official Minecraft Bedrock Edition server for players on mobile (iOS/Android), Windows 10/11, and consoles.",
    tag: "Bedrock",
    tagColor: "#14b8a6",
    defaultVersions: ["1.21.50", "1.21.40", "Latest"],
    features: ["Mobile & Console Crossplay", "Native Bedrock Protocol", "Direct Xbox Live Auth"],
  },
];

export function getSoftwareLogo(typeOrName?: string | null): string {
  if (!typeOrName) return "https://launchercontent.mojang.com/icons/minecraft.png";
  const upper = typeOrName.toUpperCase();
  const found = SOFTWARE_CATALOG.find(s => s.type === upper || s.name.toUpperCase() === upper || s.id === typeOrName.toLowerCase());
  if (found) return found.logo;
  if (upper.includes("PUMPKIN")) return "https://raw.githubusercontent.com/Pumpkin-MC/Pumpkin/master/assets/logo.png";
  if (upper.includes("PAPER")) return "https://avatars.githubusercontent.com/u/7608950?s=200&v=4";
  if (upper.includes("PURPUR")) return "https://purpurmc.org/images/purpur.svg";
  if (upper.includes("FABRIC")) return "https://avatars.githubusercontent.com/u/45091763?s=200&v=4";
  if (upper.includes("FORGE")) return "https://avatars.githubusercontent.com/u/522144?s=200&v=4";
  if (upper.includes("SPIGOT")) return "https://static.spigotmc.org/img/spigot.png";
  return "https://launchercontent.mojang.com/icons/minecraft.png";
}
