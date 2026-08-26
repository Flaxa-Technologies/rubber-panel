"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react";
import type { UserServer } from "@/lib/types";
import { ServerProvider } from "@/components/server/ServerContext";
import ServerHeader from "@/components/server/ServerHeader";
import ServerNavigation from "@/components/server/ServerNavigation";
import LoadingState from "@/components/ui/LoadingState";
import { useCustomization } from "@/components/layout/CustomizationContext";
import { useSession } from "next-auth/react";

function DiscordIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function SuspendedNotice() {
  const { discord, supportUrl, suspendedDiscordCta } = useCustomization();
  const contactLink = supportUrl || discord;

  return (
    <div className="suspended-card animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ padding: "6px", borderRadius: 6, background: "rgba(244, 63, 94, 0.12)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#f43f5e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ShieldAlert size={16} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>
              Instance Suspended
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.3)" }}>
              LOCKED
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>
            Resource utilization and power controls are locked. Please contact our support team to reactivate this server.
          </p>
        </div>
      </div>

      {suspendedDiscordCta && contactLink && (
        <a
          href={contactLink}
          target="_blank"
          rel="noreferrer"
          className="btn-discord"
          style={{ flexShrink: 0 }}
        >
          <DiscordIcon size={14} />
          <span>Contact on Discord</span>
        </a>
      )}
    </div>
  );
}

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.role === "ADMIN";

  const [server, setServer] = useState<UserServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadServer = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/user/servers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setServer(data);
        setError("");
      } else {
        if (!server) {
          setError("Server not found or access denied.");
        }
      }
    } catch {
      if (!server) setError("Failed to connect to server API.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id, server]);

  useEffect(() => { 
    loadServer(true); 
    const interval = setInterval(() => {
      loadServer(false);
    }, 2500);
    return () => clearInterval(interval);
  }, [id]);

  function handleOptimisticStatus(newStatus: string) {
    if (server) {
      setServer({ ...server, status: newStatus as any });
    }
  }

  if (loading && !server) return <LoadingState message="Loading server..." fullPage />;

  if (error && !server) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, textAlign: "center" }}>
        <AlertTriangle size={32} style={{ color: "var(--red)", marginBottom: 12 }} />
        <p style={{ fontWeight: 500 }}>{error || "Server not found"}</p>
        <Link href="/dashboard" className="btn btn-ghost" style={{ marginTop: 16 }}>
          <ArrowLeft size={14} /> Back to instances
        </Link>
      </div>
    );
  }

  if (!server) return null;

  const isLockedForUser = server.suspended && !isAdmin;

  return (
    <ServerProvider server={server} refreshServer={loadServer}>
      <div>
        <ServerHeader 
          server={server} 
          onActionComplete={() => setTimeout(() => loadServer(false), 1000)}
          onOptimisticStatus={handleOptimisticStatus}
        />
        {server.suspended && <SuspendedNotice />}
        {!isLockedForUser ? (
          <>
            <ServerNavigation serverId={id} />
            <div>{children}</div>
          </>
        ) : (
          <div className="saas-card" style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f43f5e", marginBottom: 16 }}>
              <ShieldAlert size={22} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Instance Access Suspended</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 440, lineHeight: 1.5 }}>
              Console commands, file manager operations, and power lifecycle are locked by administration. Please reach out to our team to restore your instance.
            </p>
          </div>
        )}
      </div>
    </ServerProvider>
  );
}

export { useServer } from "@/components/server/ServerContext";
