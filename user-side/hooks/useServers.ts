"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { UserServer } from "@/lib/types";

export function useServers() {
  const { data: session } = useSession();
  const [servers, setServers] = useState<UserServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadServers = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/servers");
      if (res.ok) {
        if (res.headers.get("content-type")?.includes("application/json")) {
          const d = await res.json();
          setServers(d.servers ?? []);
        } else {
          window.location.href = "/login";
        }
      } else {
        setError("Failed to load servers.");
      }
    } catch {
      setError("Failed to load servers.");
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadServers();
  }, [session, loadServers]);

  return { servers, loading, error, reload: loadServers };
}
