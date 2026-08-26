"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Server, Search, Plus, Activity } from "lucide-react";
import { useServers } from "@/hooks/useServers";
import { countServersByStatus } from "@/lib/server-utils";
import ServerCard from "@/components/server/ServerCard";
import { useState } from "react";

export default function UserDashboard() {
  const { data: session } = useSession();
  const { servers, loading, reload } = useServers();
  const stats = countServersByStatus(servers);
  const [search, setSearch] = useState("");

  const filtered = servers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.node?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", width: "100%" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-pure)", letterSpacing: "-0.02em" }}>
            Instances
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Manage and monitor your game servers in real time.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-surface)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)", padding: "6px 12px", width: 240 }}>
            <Search size={13} style={{ color: "var(--text-dim)" }} />
            <input
              type="text"
              placeholder="Filter instances..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 12.5, width: "100%" }}
            />
          </div>

          <Link
            href="/status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: 12.5,
              fontWeight: 600,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              color: "var(--text-primary)",
              textDecoration: "none",
              transition: "all 0.15s ease",
            }}
            title="View Real-Time Node & Service Status"
          >
            <Activity size={14} style={{ color: "var(--color-rp-accent, #a3e635)" }} />
            <span>Status</span>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && servers.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, width: "100%" }}>
          <div className="saas-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Online Instances</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-pure)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot-indicator dot-online" />
              <span>{stats.running}</span>
            </div>
          </div>

          <div className="saas-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Offline Instances</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-pure)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot-indicator dot-offline" />
              <span>{stats.offline}</span>
            </div>
          </div>

          <div className="saas-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Transitioning</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-pure)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot-indicator dot-starting" />
              <span>{stats.other}</span>
            </div>
          </div>

          <div className="saas-card" style={{ padding: "14px 18px", borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Total Instances</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-pure)", marginTop: 4 }}>
              {servers.length}
            </div>
          </div>
        </div>
      )}

      {/* Instances Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, width: "100%" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="saas-card" style={{ height: 180, opacity: 0.5, borderRadius: 14 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="saas-card" style={{ padding: "64px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", borderRadius: 16, width: "100%" }}>
          <Server size={32} style={{ color: "var(--text-dim)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No instances found</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {search ? "No servers match your search criteria." : "Servers will appear here once allocated or created from your quota."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, width: "100%" }}>
          {filtered.map(server => (
            <ServerCard key={server.id} server={server} onActionComplete={() => setTimeout(reload, 2000)} />
          ))}
        </div>
      )}
    </div>
  );
}
