/**
 * Safe offline GeoIP country resolver with error handling for Next.js bundlers
 */

export function lookupCountry(ip: string): { code: string; name: string } {
  if (!ip || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return { code: "LOCAL", name: "Local / Private Network" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geoip = require("geoip-lite");
    const geo = geoip.lookup(ip);
    if (geo && geo.country) {
      return { code: geo.country, name: geo.country };
    }
  } catch {
    // Graceful fallback if data file is inaccessible during build analysis
  }

  return { code: "UN", name: "Unknown" };
}
