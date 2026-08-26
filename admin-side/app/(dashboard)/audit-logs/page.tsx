"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface AuditLog {
  id: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  result: string;
  ipAddress: string | null;
  metadata: string;
  createdAt: string;
  actor: { id: string; username: string } | null;
}

const resultVariant: Record<string, "success" | "danger"> = {
  SUCCESS: "success",
  FAILED: "danger",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/audit-logs?${params}`);
    if (res.ok) { const d = await res.json(); setLogs(d.logs); setTotal(d.total); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>{total} log entries</p>
        <Button variant="secondary" icon={RefreshCw} onClick={load} size="sm">Refresh</Button>
      </div>

      <Card padding="md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
          <input placeholder="Search by action, target, email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 rounded-lg border text-sm outline-none"
            style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border-2)", color: "var(--color-rp-text)" }} />
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="p-8 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-10 skeleton rounded-lg" />)}</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center"><p className="text-sm" style={{ color: "var(--color-rp-text-muted)" }}>No audit log entries found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-rp-border)" }}>
                  {["Timestamp", "Actor", "Action", "Target", "Result", "IP"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium" style={{ color: "var(--color-rp-text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-rp-border)" }}>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderColor: "var(--color-rp-border)" }}>
                    <td className="px-5 py-2.5 text-xs font-mono tabular-nums whitespace-nowrap" style={{ color: "var(--color-rp-text-muted)" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-xs" style={{ color: "var(--color-rp-text)" }}>
                      {log.actor?.username ?? log.actorEmail ?? "System"}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-rp-surface-2)", color: "var(--color-rp-accent)" }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs" style={{ color: "var(--color-rp-text-muted)" }}>{log.target ?? "—"}</td>
                    <td className="px-5 py-2.5">
                      <Badge variant={resultVariant[log.result] ?? "muted"}>{log.result}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-xs font-mono" style={{ color: "var(--color-rp-text-dim)" }}>{log.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Math.ceil(total / 50) > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>Page {page} of {Math.ceil(total / 50)}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
