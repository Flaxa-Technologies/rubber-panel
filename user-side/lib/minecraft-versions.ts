/**
 * Utility for Minecraft & Node.js version parsing, semantic sorting, and Java runtime recommendations.
 */

export interface MinecraftVersionItem {
  id?: string;
  version: string;
  isStable?: boolean;
}

/**
 * Compare two Minecraft or Semver version strings in descending order (newest first).
 * Examples:
 *   "26.2" > "26.1.2" > "1.21.11" > "1.21.4" > "1.21.4-rc1" > "1.20.6" > "1.12.2" > "1.8.8" > "1.7.10"
 */
export function compareMinecraftVersions(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "LATEST" || a === "latest") return -1;
  if (b === "LATEST" || b === "latest") return 1;

  const parseVer = (v: string) => {
    const isPre = /-rc|-pre|-snapshot|-beta|-alpha|-dev/i.test(v);
    const clean = v.split("-")[0].replace(/[^0-9.]/g, "");
    const parts = clean.split(".").map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return { parts, isPre, raw: v };
  };

  const pa = parseVer(a);
  const pb = parseVer(b);

  for (let i = 0; i < Math.max(pa.parts.length, pb.parts.length); i++) {
    const na = pa.parts[i] ?? 0;
    const nb = pb.parts[i] ?? 0;
    if (na !== nb) return nb - na; // Descending: larger number first
  }

  if (pa.isPre !== pb.isPre) {
    return pa.isPre ? 1 : -1;
  }

  return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sort an array of version objects or version strings descending.
 */
export function sortVersionItems<T extends { version: string } | string>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const va = typeof a === "string" ? a : a.version;
    const vb = typeof b === "string" ? b : b.version;
    return compareMinecraftVersions(va, vb);
  });
}
