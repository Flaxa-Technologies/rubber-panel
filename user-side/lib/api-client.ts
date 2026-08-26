// User-side API client — proxies to admin API
// Users NEVER call node-side directly

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

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

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Secret": INTERNAL_SECRET,
      "X-Source": "user-side",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Pass authenticated userId via trusted server-side header
    // This is never supplied by the client/browser
    if (userId) {
      headers["X-User-Id"] = userId;
    }

    const res = await fetch(`${ADMIN_API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      return { data: null, error: data.error ?? "Request failed", status: res.status };
    }

    return { data, error: null, status: res.status };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error",
      status: 500,
    };
  }
}

export async function getPublicConfig(): Promise<{
  registrationEnabled: boolean;
  siteName: string;
  siteDescription: string;
  accentColor?: string;
}> {
  try {
    // Use a relative URL so browsers call same-origin (port 3002), avoiding CORS
    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002");
    const res = await fetch(`${base}/api/config`, { cache: "no-store" });
    if (res.ok) return res.json();
  } catch {}
  return { registrationEnabled: false, siteName: "Rubber Panel", siteDescription: "", accentColor: "#a3e635" };
}
