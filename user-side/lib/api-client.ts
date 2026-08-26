// User-side API client — proxies to admin API
// Users NEVER call node-side directly

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "rubber-panel-internal-secret";

interface ApiClientOptions {
  userId?: string;
  token?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function adminApiFetch<T>(
  path: string,
  options: ApiClientOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { method = "GET", body, token, userId } = options;

  const targets = [
    process.env.ADMIN_API_URL || "http://127.0.0.1:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ];

  const uniqueTargets = Array.from(new Set(targets.filter(Boolean)));
  let lastError: any = null;

  for (const base of uniqueTargets) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
        "X-Source": "user-side",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (userId) {
        headers["X-User-Id"] = userId;
      }

      const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return { data: null, error: data?.error ?? "Request failed", status: res.status };
      }

      return { data, error: null, status: res.status };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    data: null,
    error: lastError instanceof Error ? lastError.message : "Network error",
    status: 500,
  };
}

export async function getPublicConfig(): Promise<{
  registrationEnabled: boolean;
  siteName: string;
  siteDescription: string;
  accentColor?: string;
}> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3002");
    const res = await fetch(`${base}/api/config?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Pragma": "no-cache" },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        registrationEnabled: data.registrationEnabled === true,
        siteName: data.siteName || "Rubber Panel",
        siteDescription: data.siteDescription || "Professional Minecraft Hosting",
        accentColor: data.accentColor || "#a3e635",
      };
    }
  } catch {}
  return { registrationEnabled: false, siteName: "Rubber Panel", siteDescription: "", accentColor: "#a3e635" };
}
