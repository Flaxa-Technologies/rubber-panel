/**
 * Rubber Panel — Cloudflare DNS Management Service
 * Dynamic Minecraft SRV Records & Node Target A Records Engine
 */

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  name_servers?: string[];
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  data?: {
    service?: string;
    proto?: string;
    name?: string;
    priority?: number;
    weight?: number;
    port?: number;
    target?: string;
  };
}

export interface CloudflareApiResponse<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: string[];
  result?: T;
  result_info?: {
    page: number;
    per_page: number;
    total_count: number;
  };
}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Verify Cloudflare API Token validity
 */
export async function verifyCloudflareToken(apiToken: string): Promise<{ valid: boolean; message?: string }> {
  try {
    const res = await fetch(`${CF_API_BASE}/user/tokens/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<{ id: string; status: string }>;
    if (res.ok && data.success && data.result?.status === "active") {
      return { valid: true };
    }

    const errMsg = data.errors?.[0]?.message || "Invalid or inactive Cloudflare API token";
    return { valid: false, message: errMsg };
  } catch (err: any) {
    return { valid: false, message: err?.message || "Failed to reach Cloudflare API" };
  }
}

/**
 * Find Cloudflare Zone by Domain Name (e.g. "example.com")
 */
export async function getZoneByDomainName(apiToken: string, domainName: string): Promise<CloudflareZone | null> {
  try {
    const cleanDomain = domainName.trim().toLowerCase();
    const res = await fetch(`${CF_API_BASE}/zones?name=${encodeURIComponent(cleanDomain)}&status=active`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareZone[]>;
    if (res.ok && data.success && Array.isArray(data.result) && data.result.length > 0) {
      return data.result[0];
    }
    return null;
  } catch (err) {
    console.error("Cloudflare getZoneByDomainName error:", err);
    return null;
  }
}

/**
 * Ensure an A record exists for the Node Target Host
 * Example: targetHost = "node-alpha.example.com", nodeIp = "142.250.190.46"
 */
export async function ensureNodeTargetRecord(
  apiToken: string,
  zoneId: string,
  domainName: string,
  targetHost: string,
  nodeIp: string
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const cleanTarget = targetHost.trim().toLowerCase();
    const cleanIp = nodeIp.trim();

    // Check if record already exists
    const searchRes = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(cleanTarget)}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken.trim()}`,
          "Content-Type": "application/json",
        },
      }
    );

    const searchData = (await searchRes.json()) as CloudflareApiResponse<CloudflareDnsRecord[]>;
    if (searchRes.ok && searchData.success && searchData.result && searchData.result.length > 0) {
      const existing = searchData.result[0];
      if (existing.content === cleanIp && !existing.proxied) {
        return { success: true, recordId: existing.id };
      }

      // Update IP / ensure proxied is false (Minecraft requires DNS-only resolution)
      const updateRes = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${existing.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "A",
          name: cleanTarget,
          content: cleanIp,
          ttl: 1, // Auto
          proxied: false,
          comment: "Rubber Panel Node Target A Record",
        }),
      });

      const updateData = (await updateRes.json()) as CloudflareApiResponse<CloudflareDnsRecord>;
      if (updateRes.ok && updateData.success && updateData.result) {
        return { success: true, recordId: updateData.result.id };
      }
    }

    // Create new A record
    const createRes = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "A",
        name: cleanTarget,
        content: cleanIp,
        ttl: 1,
        proxied: false,
        comment: "Rubber Panel Node Target A Record",
      }),
    });

    const createData = (await createRes.json()) as CloudflareApiResponse<CloudflareDnsRecord>;
    if (createRes.ok && createData.success && createData.result) {
      return { success: true, recordId: createData.result.id };
    }

    const errMsg = createData.errors?.[0]?.message || "Failed to create Node target A record in Cloudflare";
    return { success: false, error: errMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error contacting Cloudflare API" };
  }
}

/**
 * Create an individual Minecraft SRV record
 * _minecraft._tcp.<subdomain>.<domain> -> Target Host: <targetHost>, Port: <port>
 */
export async function createMinecraftSrvRecord(
  apiToken: string,
  zoneId: string,
  domainName: string,
  subdomain: string,
  targetHost: string,
  port: number
): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const cleanSub = subdomain.trim().toLowerCase();
    const cleanDomain = domainName.trim().toLowerCase();
    const cleanTarget = targetHost.trim().toLowerCase();

    // SRV Payload structure for Cloudflare
    const payload = {
      type: "SRV",
      data: {
        service: "_minecraft",
        proto: "_tcp",
        name: cleanSub, // Cloudflare accepts subdomain relative to zone
        priority: 0,
        weight: 5,
        port: port,
        target: cleanTarget,
      },
      ttl: 1, // Auto
      proxied: false,
      comment: `Rubber Panel Minecraft SRV for ${cleanSub}.${cleanDomain}`,
    };

    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareDnsRecord>;
    if (res.ok && data.success && data.result) {
      return { success: true, recordId: data.result.id };
    }

    const errMsg = data.errors?.[0]?.message || "Cloudflare rejected SRV record creation";
    return { success: false, error: errMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to communicate with Cloudflare DNS API" };
  }
}

/**
 * Update an existing Minecraft SRV record (e.g. port or target host change)
 */
export async function updateMinecraftSrvRecord(
  apiToken: string,
  zoneId: string,
  recordId: string,
  domainName: string,
  subdomain: string,
  targetHost: string,
  port: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanSub = subdomain.trim().toLowerCase();
    const cleanDomain = domainName.trim().toLowerCase();
    const cleanTarget = targetHost.trim().toLowerCase();

    const payload = {
      type: "SRV",
      data: {
        service: "_minecraft",
        proto: "_tcp",
        name: cleanSub,
        priority: 0,
        weight: 5,
        port: port,
        target: cleanTarget,
      },
      ttl: 1,
      proxied: false,
      comment: `Rubber Panel Minecraft SRV for ${cleanSub}.${cleanDomain}`,
    };

    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareDnsRecord>;
    if (res.ok && data.success) {
      return { success: true };
    }

    const errMsg = data.errors?.[0]?.message || "Failed to update SRV record on Cloudflare";
    return { success: false, error: errMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error updating SRV record" };
  }
}

/**
 * Delete a DNS record safely by recordId
 */
export async function deleteDnsRecord(
  apiToken: string,
  zoneId: string,
  recordId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        "Content-Type": "application/json",
      },
    });

    // If 404, it was already deleted, consider successful
    if (res.status === 404) {
      return { success: true };
    }

    const data = (await res.json()) as CloudflareApiResponse<{ id: string }>;
    if (res.ok && data.success) {
      return { success: true };
    }

    const errMsg = data.errors?.[0]?.message || "Failed to delete record from Cloudflare";
    return { success: false, error: errMsg };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error deleting DNS record" };
  }
}

/**
 * Query live DNS-over-HTTPS to verify public resolution of the SRV record
 */
export async function testSrvDnsResolution(
  fqdn: string
): Promise<{ resolved: boolean; target?: string; port?: number; error?: string }> {
  try {
    const queryName = `_minecraft._tcp.${fqdn.trim().toLowerCase()}`;
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(queryName)}&type=SRV`, {
      headers: {
        Accept: "application/dns-json",
      },
    });

    if (!res.ok) {
      return { resolved: false, error: `DoH query failed with status ${res.status}` };
    }

    const data = await res.json();
    if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) {
      const answer = data.Answer[0];
      // SRV data format: "priority weight port target" (e.g. "0 5 25565 node-1.example.com.")
      const parts = (answer.data || "").split(" ");
      if (parts.length >= 4) {
        return {
          resolved: true,
          port: parseInt(parts[2], 10),
          target: parts[3].replace(/\.$/, ""),
        };
      }
      return { resolved: true };
    }

    return { resolved: false, error: "Record not yet propagated or not found on public DNS" };
  } catch (err: any) {
    return { resolved: false, error: err?.message || "DNS lookup failed" };
  }
}
