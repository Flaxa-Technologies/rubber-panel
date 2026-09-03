"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database, Table, Terminal, Play, RefreshCw, X, ChevronLeft, ChevronRight,
  Search, AlertCircle, CheckCircle2, Clock, Layers, Hash, Code, Sparkles, Loader2
} from "lucide-react";

interface ColumnDef {
  field: string;
  type: string;
  null: string;
  key: string;
  default: string | null;
  extra: string;
}

interface TableInfo {
  name: string;
  rows: number;
  dataLength: number;
  engine: string;
  collation: string;
}

interface SqlQueryResult {
  success: boolean;
  isSelect?: boolean;
  durationMs?: number;
  columns?: string[];
  rows?: any[];
  rowCount?: number;
  affectedRows?: number;
  insertId?: number;
  message?: string;
  error?: string;
}

export default function DatabaseExplorerModal({
  isOpen,
  onClose,
  serverId,
  databaseId,
  databaseName,
  hostEndpoint,
}: {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  databaseId: string;
  databaseName: string;
  hostEndpoint: string;
}) {
  const [activeTab, setActiveTab] = useState<"data" | "schema" | "sql">("data");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableSearch, setTableSearch] = useState("");
  const [loadingTables, setLoadingTables] = useState(false);

  // Table Data State
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");

  // SQL Shell State
  const [sqlQuery, setSqlQuery] = useState(`SELECT * FROM \`\` LIMIT 20;`);
  const [runningSql, setRunningSql] = useState(false);
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [sqlError, setSqlError] = useState("");

  // Load Tables
  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const res = await fetch(`/api/user/servers/${serverId}/databases/${databaseId}/explorer?action=tables`);
      if (res.ok) {
        const data = await res.json();
        const tList: TableInfo[] = data.tables || [];
        setTables(tList);
        if (tList.length > 0 && !selectedTable) {
          setSelectedTable(tList[0].name);
          setSqlQuery(`SELECT * FROM \`${tList[0].name}\` LIMIT 20;`);
        }
      }
    } catch {}
    setLoadingTables(false);
  }, [serverId, databaseId, selectedTable]);

  // Load Table Data & Schema
  const loadTableData = useCallback(async (tableName: string, page: number = 1) => {
    if (!tableName) return;
    setLoadingData(true);
    setDataError("");
    try {
      const res = await fetch(
        `/api/user/servers/${serverId}/databases/${databaseId}/explorer?action=data&table=${encodeURIComponent(tableName)}&page=${page}&limit=${pageSize}`
      );
      if (res.ok) {
        const data = await res.json();
        setColumns(data.columns || []);
        setRows(data.rows || []);
        setTotalRows(data.total || 0);
        setCurrentPage(page);
      } else {
        const err = await res.json().catch(() => ({}));
        setDataError(err.error || "Failed to load table data");
      }
    } catch {
      setDataError("Network error loading table data");
    } finally {
      setLoadingData(false);
    }
  }, [serverId, databaseId, pageSize]);

  useEffect(() => {
    if (isOpen) {
      loadTables();
    }
  }, [isOpen, loadTables]);

  useEffect(() => {
    if (selectedTable && isOpen) {
      loadTableData(selectedTable, 1);
      setSqlQuery(`SELECT * FROM \`${selectedTable}\` LIMIT 20;`);
    }
  }, [selectedTable, isOpen, loadTableData]);

  // Execute SQL
  async function runQuery() {
    if (!sqlQuery.trim()) return;
    setRunningSql(true);
    setSqlError("");
    setSqlResult(null);

    try {
      const res = await fetch(`/api/user/servers/${serverId}/databases/${databaseId}/explorer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sqlQuery.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSqlResult(data);
        // Refresh tables if DDL command was executed
        if (sqlQuery.toUpperCase().includes("CREATE") || sqlQuery.toUpperCase().includes("DROP") || sqlQuery.toUpperCase().includes("ALTER")) {
          loadTables();
        }
      } else {
        setSqlError(data.error || "SQL execution failed");
      }
    } catch (err: any) {
      setSqlError(err?.message || "Network error running query");
    } finally {
      setRunningSql(false);
    }
  }

  // Ctrl+Enter hotkey for SQL run
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
  }

  if (!isOpen) return null;

  const filteredTables = tables.filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()));
  const totalPages = Math.ceil(totalRows / pageSize) || 1;

  return (
    <div className="saas-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="saas-modal-box"
        style={{
          width: "95vw",
          maxWidth: "1280px",
          height: "88vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f59e0b",
              }}
            >
              <Database size={16} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, fontFamily: "monospace", color: "var(--text-pure)" }}>
                  {databaseName}
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: "var(--bg-surface)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {hostEndpoint}
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                Web Database Explorer &amp; Interactive SQL Shell
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                background: "var(--bg-surface)",
                padding: 3,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-medium)",
              }}
            >
              <button
                onClick={() => setActiveTab("data")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: activeTab === "data" ? 700 : 500,
                  borderRadius: "calc(var(--radius-sm) - 2px)",
                  background: activeTab === "data" ? "#ffffff" : "transparent",
                  color: activeTab === "data" ? "#000000" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Table size={13} />
                <span>Table Data</span>
              </button>

              <button
                onClick={() => setActiveTab("schema")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: activeTab === "schema" ? 700 : 500,
                  borderRadius: "calc(var(--radius-sm) - 2px)",
                  background: activeTab === "schema" ? "#ffffff" : "transparent",
                  color: activeTab === "schema" ? "#000000" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Layers size={13} />
                <span>Columns &amp; Types</span>
              </button>

              <button
                onClick={() => setActiveTab("sql")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: activeTab === "sql" ? 700 : 500,
                  borderRadius: "calc(var(--radius-sm) - 2px)",
                  background: activeTab === "sql" ? "#a3e635" : "transparent",
                  color: activeTab === "sql" ? "#000000" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Terminal size={13} />
                <span>SQL Shell</span>
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 6,
                borderRadius: "var(--radius-sm)",
              }}
              title="Close Explorer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Main Body: 2-Column Split View */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left Column: Tables Sidebar */}
          <div
            style={{
              width: 250,
              minWidth: 220,
              borderRight: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-surface)",
            }}
          >
            {/* Table Search */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                <input
                  type="text"
                  placeholder="Filter tables..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="saas-input"
                  style={{ height: 30, paddingLeft: 28, fontSize: 11.5 }}
                />
              </div>
            </div>

            {/* Tables List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
              {loadingTables ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)" }}>
                  <Loader2 size={16} className="spin" style={{ margin: "0 auto 6px" }} />
                  <span style={{ fontSize: 11 }}>Scanning tables...</span>
                </div>
              ) : filteredTables.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 11.5 }}>
                  {tables.length === 0 ? "No tables found" : "No matching tables"}
                </div>
              ) : (
                filteredTables.map((t) => {
                  const isSelected = selectedTable === t.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => {
                        setSelectedTable(t.name);
                        if (activeTab === "sql") {
                          setSqlQuery(`SELECT * FROM \`${t.name}\` LIMIT 20;`);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        background: isSelected ? "var(--bg-surface-elevated)" : "transparent",
                        border: isSelected ? "1px solid var(--border-medium)" : "1px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        textAlign: "left",
                        marginBottom: 2,
                        transition: "all 0.1s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <Table size={13} style={{ color: isSelected ? "#a3e635" : "var(--text-dim)", flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "var(--text-pure)" : "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          color: "var(--text-dim)",
                          background: "rgba(255,255,255,0.04)",
                          padding: "1px 5px",
                          borderRadius: 4,
                          flexShrink: 0,
                          marginLeft: 6,
                        }}
                      >
                        {t.rows}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer */}
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: 11,
                color: "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-surface-elevated)",
              }}
            >
              <span>{tables.length} tables</span>
              <button
                onClick={loadTables}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
                title="Refresh Table List"
              >
                <RefreshCw size={12} className={loadingTables ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Right Column: Content Views */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg-surface-elevated)" }}>
            {/* ── View 1: Table Data (GUI Grid) ── */}
            {activeTab === "data" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                {/* Data Toolbar */}
                <div
                  style={{
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text-pure)" }}>
                      {selectedTable || "No Table Selected"}
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                      ({totalRows} total rows)
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => loadTableData(selectedTable, currentPage)}
                      disabled={loadingData || !selectedTable}
                      className="btn-secondary-dark"
                      style={{ padding: "4px 10px", fontSize: 11.5 }}
                    >
                      <RefreshCw size={12} className={loadingData ? "spin" : ""} />
                      <span>Refresh</span>
                    </button>

                    {/* Pagination */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                      <button
                        onClick={() => loadTableData(selectedTable, currentPage - 1)}
                        disabled={currentPage <= 1 || loadingData}
                        className="btn-secondary-dark"
                        style={{ padding: "4px 8px", fontSize: 11.5 }}
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <span style={{ fontSize: 11.5, color: "var(--text-secondary)", minWidth: 70, textAlign: "center" }}>
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => loadTableData(selectedTable, currentPage + 1)}
                        disabled={currentPage >= totalPages || loadingData}
                        className="btn-secondary-dark"
                        style={{ padding: "4px 8px", fontSize: 11.5 }}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {dataError && (
                  <div style={{ padding: "10px 16px", background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 12 }}>
                    {dataError}
                  </div>
                )}

                {/* Table Data Grid */}
                <div style={{ flex: 1, overflow: "auto" }}>
                  {loadingData ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-dim)" }}>
                      <Loader2 size={20} className="spin" style={{ margin: "0 auto 8px" }} />
                      <span style={{ fontSize: 12 }}>Fetching rows...</span>
                    </div>
                  ) : rows.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
                      This table has 0 rows recorded.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-medium)", position: "sticky", top: 0, zIndex: 10 }}>
                          <th style={{ padding: "8px 12px", color: "var(--text-dim)", fontSize: 11, borderRight: "1px solid var(--border-subtle)", width: 40, textAlign: "center" }}>
                            #
                          </th>
                          {columns.map((c) => (
                            <th key={c.field} style={{ padding: "8px 12px", color: "var(--text-pure)", borderRight: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span>{c.field}</span>
                                <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400 }}>{c.type}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: "1px solid var(--border-subtle)",
                              background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                            }}
                          >
                            <td style={{ padding: "6px 12px", color: "var(--text-dim)", borderRight: "1px solid var(--border-subtle)", textAlign: "center", fontSize: 10.5 }}>
                              {(currentPage - 1) * pageSize + idx + 1}
                            </td>
                            {columns.map((c) => {
                              const val = row[c.field];
                              return (
                                <td
                                  key={c.field}
                                  style={{
                                    padding: "6px 12px",
                                    borderRight: "1px solid var(--border-subtle)",
                                    whiteSpace: "nowrap",
                                    maxWidth: 240,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    color: val === null ? "var(--text-dim)" : "var(--text-primary)",
                                    fontStyle: val === null ? "italic" : "normal",
                                  }}
                                  title={val !== null ? String(val) : "NULL"}
                                >
                                  {val === null ? "NULL" : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── View 2: Table Schema (Columns Definition) ── */}
            {activeTab === "schema" && (
              <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                <div className="saas-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Layers size={14} style={{ color: "#a3e635" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text-pure)" }}>
                      {selectedTable} — Schema Structure
                    </span>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-surface-elevated)", borderBottom: "1px solid var(--border-medium)" }}>
                        <th style={{ padding: "8px 14px", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase" }}>Column</th>
                        <th style={{ padding: "8px 14px", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase" }}>Type</th>
                        <th style={{ padding: "8px 14px", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase" }}>Null</th>
                        <th style={{ padding: "8px 14px", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase" }}>Key</th>
                        <th style={{ padding: "8px 14px", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase" }}>Default</th>
                        <th style={{ padding: "8px 14px", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase" }}>Extra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((col) => (
                        <tr key={col.field} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 14px", fontFamily: "monospace", fontWeight: 700, color: "var(--text-pure)" }}>
                            {col.field}
                          </td>
                          <td style={{ padding: "8px 14px", fontFamily: "monospace", color: "#38bdf8" }}>
                            {col.type}
                          </td>
                          <td style={{ padding: "8px 14px", color: col.null === "YES" ? "var(--text-dim)" : "var(--text-secondary)" }}>
                            {col.null}
                          </td>
                          <td style={{ padding: "8px 14px" }}>
                            {col.key === "PRI" ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                PRIMARY KEY
                              </span>
                            ) : (
                              col.key || "—"
                            )}
                          </td>
                          <td style={{ padding: "8px 14px", fontFamily: "monospace", color: "var(--text-dim)" }}>
                            {col.default ?? "NULL"}
                          </td>
                          <td style={{ padding: "8px 14px", color: "var(--text-dim)" }}>
                            {col.extra || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── View 3: Interactive SQL Shell / Command Terminal ── */}
            {activeTab === "sql" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                {/* SQL Editor Area */}
                <div style={{ padding: "14px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
                  {/* Quick Query Snippet Chips */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, overflowX: "auto" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Snippets:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSqlQuery(selectedTable ? `SELECT * FROM \`${selectedTable}\` LIMIT 50;` : `SHOW TABLES;`)}
                      style={{ padding: "2px 8px", borderRadius: 4, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}
                    >
                      SELECT *
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlQuery(selectedTable ? `SELECT COUNT(*) FROM \`${selectedTable}\`;` : `SHOW TABLES;`)}
                      style={{ padding: "2px 8px", borderRadius: 4, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}
                    >
                      COUNT(*)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlQuery(`SHOW TABLES;`)}
                      style={{ padding: "2px 8px", borderRadius: 4, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}
                    >
                      SHOW TABLES
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlQuery(selectedTable ? `DESCRIBE \`${selectedTable}\`;` : `SHOW TABLES;`)}
                      style={{ padding: "2px 8px", borderRadius: 4, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}
                    >
                      DESCRIBE
                    </button>
                  </div>

                  {/* SQL Textarea */}
                  <textarea
                    rows={4}
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter SQL command... (e.g. SELECT * FROM users WHERE active = 1;)"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid var(--border-medium)",
                      color: "#a3e635",
                      fontSize: 13,
                      fontFamily: "monospace",
                      outline: "none",
                      resize: "vertical",
                      lineHeight: 1.5,
                    }}
                  />

                  {/* Action Bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      Press <kbd style={{ padding: "1px 5px", borderRadius: 3, background: "var(--bg-surface-elevated)", border: "1px solid var(--border-medium)" }}>Ctrl + Enter</kbd> to execute
                    </span>

                    <button
                      onClick={runQuery}
                      disabled={runningSql || !sqlQuery.trim()}
                      className="btn-solid-white"
                      style={{
                        padding: "6px 16px",
                        fontSize: 12,
                        background: "#a3e635",
                        color: "#000000",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {runningSql ? <Loader2 size={13} className="spin" /> : <Play size={13} fill="#000000" />}
                      <span>{runningSql ? "Executing..." : "Run Query"}</span>
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {sqlError && (
                  <div style={{ padding: "10px 16px", background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{sqlError}</span>
                  </div>
                )}

                {/* Result Display Area */}
                <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                  {sqlResult ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      {/* Telemetry Bar */}
                      <div style={{ padding: "6px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
                        <span style={{ color: "#34d399", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={12} />
                          Query Executed Successfully
                        </span>
                        <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={12} />
                          {sqlResult.durationMs}ms
                        </span>
                        <span style={{ color: "var(--text-dim)" }}>
                          {sqlResult.isSelect ? `${sqlResult.rowCount} rows returned` : `${sqlResult.affectedRows} rows affected`}
                        </span>
                      </div>

                      {/* Result Rows Table */}
                      {sqlResult.isSelect && sqlResult.rows ? (
                        <div style={{ flex: 1, overflow: "auto" }}>
                          {sqlResult.rows.length === 0 ? (
                            <div style={{ padding: 36, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
                              Query returned 0 rows.
                            </div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace", textAlign: "left" }}>
                              <thead>
                                <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-medium)", position: "sticky", top: 0 }}>
                                  <th style={{ padding: "6px 10px", color: "var(--text-dim)", borderRight: "1px solid var(--border-subtle)", width: 36, textAlign: "center" }}>#</th>
                                  {sqlResult.columns?.map((col) => (
                                    <th key={col} style={{ padding: "6px 10px", color: "var(--text-pure)", borderRight: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sqlResult.rows.map((row, idx) => (
                                  <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                    <td style={{ padding: "5px 10px", color: "var(--text-dim)", borderRight: "1px solid var(--border-subtle)", textAlign: "center", fontSize: 10.5 }}>
                                      {idx + 1}
                                    </td>
                                    {sqlResult.columns?.map((col) => (
                                      <td
                                        key={col}
                                        style={{
                                          padding: "5px 10px",
                                          borderRight: "1px solid var(--border-subtle)",
                                          whiteSpace: "nowrap",
                                          maxWidth: 260,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          color: row[col] === null ? "var(--text-dim)" : "var(--text-primary)",
                                        }}
                                        title={row[col] !== null ? String(row[col]) : "NULL"}
                                      >
                                        {row[col] === null ? "NULL" : String(row[col])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: 24, fontSize: 12, color: "var(--text-secondary)" }}>
                          <p>{sqlResult.message || `Query OK, ${sqlResult.affectedRows} row(s) affected.`}</p>
                          {sqlResult.insertId ? <p style={{ marginTop: 4, fontFamily: "monospace", color: "#a3e635" }}>Last Insert ID: {sqlResult.insertId}</p> : null}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
                      Enter a SQL command above and press &quot;Run Query&quot; to see real-time output.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
