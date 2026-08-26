"use client";

import { useEffect, useState } from "react";
import { Users, Server, MonitorSpeaker, Activity, Cpu, MemoryStick, HardDrive, Wifi } from "lucide-react";
import { StatCard, Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ResourceBar, Gauge } from "@/components/ui/ResourceBar";

interface DashboardStats {
  users: { total: number; active: number; suspended: number };
  servers: { total: number; running: number; stopped: number; suspended: number };
  nodes: { total: number; online: number; offline: number };
  resources: { cpu: number; ram: number; disk: number; networkRx: number; networkTx: number };
  recentActivity: Array<{
    id: string;
    actorEmail: string;
    action: string;
    target: string;
    result: string;
    createdAt: string;
  }>;
}

const actionLabels: Record<string, string> = {
  USER_CREATED: "Created user",
  USER_SUSPENDED: "Suspended user",
  USER_DELETED: "Deleted user",
  SERVER_CREATED: "Created server",
  SERVER_DELETED: "Deleted server",
  SERVER_STARTED: "Started server",
  SERVER_STOPPED: "Stopped server",
  NODE_CREATED: "Added node",
  SETTINGS_CHANGED: "Changed settings",
  USER_LOGIN: "Admin login",
};

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) +
    " · " + date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--color-rp-text-muted)" }}>Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-rp-text)" }}>
          Welcome back
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-rp-text-muted)" }}>
          Here's what's happening on your Rubber Panel infrastructure.
        </p>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={stats.users.total}
          icon={Users}
          sublabel={`${stats.users.active} active · ${stats.users.suspended} suspended`}
          accentColor="var(--color-rp-blue)"
        />
        <StatCard
          label="Total Servers"
          value={stats.servers.total}
          icon={Server}
          sublabel={`${stats.servers.running} running · ${stats.servers.stopped} stopped`}
          accentColor="var(--color-rp-accent)"
        />
        <StatCard
          label="Online Nodes"
          value={`${stats.nodes.online} / ${stats.nodes.total}`}
          icon={MonitorSpeaker}
          sublabel={`${stats.nodes.offline} offline`}
          accentColor="var(--color-rp-green)"
        />
        <StatCard
          label="Running Servers"
          value={stats.servers.running}
          icon={Activity}
          sublabel={`${stats.servers.suspended} suspended`}
          accentColor="var(--color-rp-orange)"
        />
      </div>

      {/* Resources + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resource Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <Badge variant="muted">Avg. across nodes</Badge>
          </CardHeader>

          <div className="flex justify-around mb-6">
            <Gauge value={stats.resources.cpu} label="CPU" unit="%" />
            <Gauge value={stats.resources.ram} label="RAM" unit="%" />
            <Gauge value={stats.resources.disk} label="Disk" unit="%" />
          </div>

          <div className="space-y-3">
            <ResourceBar label="CPU Usage" used={stats.resources.cpu} unit="%" />
            <ResourceBar label="RAM Usage" used={stats.resources.ram} unit="%" />
            <ResourceBar label="Disk Usage" used={stats.resources.disk} unit="%" />
            <ResourceBar label="Network RX" used={stats.resources.networkRx / 1024} unit=" MB/s" />
            <ResourceBar label="Network TX" used={stats.resources.networkTx / 1024} unit=" MB/s" />
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2" padding="none">
          <div className="p-5 border-b" style={{ borderColor: "var(--color-rp-border)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-rp-text)" }}>Recent Activity</h3>
              <a href="/audit-logs" className="text-xs font-medium" style={{ color: "var(--color-rp-accent)" }}>
                View all →
              </a>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
            {stats.recentActivity.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>No recent activity</p>
              </div>
            ) : (
              stats.recentActivity.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-accent)" }}
                    >
                      {log.actorEmail?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-rp-text)" }}>
                        {actionLabels[log.action] ?? log.action}
                        {log.target && <span style={{ color: "var(--color-rp-text-muted)" }}> — {log.target}</span>}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--color-rp-text-muted)" }}>
                        {log.actorEmail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <StatusBadge status={log.result} />
                    <span className="text-xs tabular-nums" style={{ color: "var(--color-rp-text-dim)" }}>
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Users", value: stats.users.active, color: "var(--color-rp-green)" },
          { label: "Suspended Users", value: stats.users.suspended, color: "var(--color-rp-red)" },
          { label: "Stopped Servers", value: stats.servers.stopped, color: "var(--color-rp-text-muted)" },
          { label: "Offline Nodes", value: stats.nodes.offline, color: "var(--color-rp-yellow)" },
        ].map((item) => (
          <Card key={item.label} padding="md">
            <p className="text-xs font-medium mb-2" style={{ color: "var(--color-rp-text-muted)" }}>{item.label}</p>
            <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
