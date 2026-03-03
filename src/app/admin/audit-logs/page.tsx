"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Search, Download, ChevronDown } from "lucide-react";

interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  resource: string;
  level: string;
  ipAddress: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  today: number;
  warnings: number;
  errors: number;
  thisWeek: number;
}

const levelBadge: Record<string, { color: string; bg: string }> = {
  info: { color: "text-[#2563EB]", bg: "bg-[#EFF6FF]" },
  warning: { color: "text-[#F59E0B]", bg: "bg-[#FFFBEB]" },
  error: { color: "text-[#EF4444]", bg: "bg-[#FEF2F2]" },
};

const PAGE_SIZE = 6;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    today: 0,
    warnings: 0,
    errors: 0,
    thisWeek: 0,
  });
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("7");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(() => {
    fetch("/api/admin/audit-logs")
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs);
        setStats(data.stats);
      });
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionNames = [...new Set(logs.map((l) => l.action))];

  const now = new Date();
  const dateRangeMs: Record<string, number> = {
    "1": 24 * 60 * 60 * 1000,
    "7": 7 * 24 * 60 * 60 * 1000,
    "30": 30 * 24 * 60 * 60 * 1000,
    "all": Infinity,
  };

  const filtered = logs.filter((l) => {
    const matchesSearch =
      !search ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      l.resource.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "all" || l.level === levelFilter;
    const matchesAction = actionFilter === "all" || l.action === actionFilter;
    const logAge = now.getTime() - new Date(l.createdAt).getTime();
    const matchesDate = dateFilter === "all" || logAge <= dateRangeMs[dateFilter];
    return matchesSearch && matchesLevel && matchesAction && matchesDate;
  });

  useEffect(() => {
    setPage(1);
  }, [search, levelFilter, actionFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpis = [
    {
      label: "Total Events",
      value: stats.total.toLocaleString(),
      sub: `+${stats.thisWeek} this week`,
      subColor: "text-[#16A34A]",
      valueColor: "",
    },
    {
      label: "Today",
      value: stats.today,
      sub: "Last 24 hours",
      subColor: "text-[#94A3B8]",
      valueColor: "",
    },
    {
      label: "Warnings",
      value: stats.warnings,
      sub: `${stats.warnings} unresolved`,
      subColor: "text-[#F59E0B]",
      valueColor: "text-[#F59E0B]",
    },
    {
      label: "Errors",
      value: stats.errors,
      sub: `${stats.errors} critical`,
      subColor: "text-[#EF4444]",
      valueColor: "text-[#EF4444]",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">Audit Logs</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Track every admin action across the platform
          </p>
        </div>
        <button className="flex items-center gap-1.5 h-[38px] rounded-lg border border-[#E2E8F0] bg-white px-4 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <span className="text-[12px] text-[#94A3B8]">{kpi.label}</span>
            <p
              className={`text-[24px] font-bold tracking-tight tabular-nums mt-1 ${kpi.valueColor || "text-[#0F172A]"}`}
            >
              {kpi.value}
            </p>
            <span className={`text-[12px] ${kpi.subColor}`}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Search + Filters */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search by action or user..."
              className="h-[34px] w-[260px] rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="all">All Actions</option>
                {actionNames.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="1">Last 24h</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="all">All time</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9]">
              {["Timestamp", "User", "Action", "Resource", "Level", "IP Address"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((log) => {
              const badge = levelBadge[log.level] || levelBadge.info;
              return (
                <tr
                  key={log.id}
                  className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-5 py-3 text-[12px] text-[#94A3B8]">
                    {new Date(log.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "2-digit",
                    })}{" "}
                    {new Date(log.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-medium text-[#0F172A]">
                    {log.userEmail}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] font-medium text-[#2563EB]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#64748B] max-w-xs truncate">
                    {log.resource}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${badge.color} ${badge.bg}`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] font-mono text-[#94A3B8]">
                    {log.ipAddress || "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <FileText className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" />
                  <p className="text-[13px] text-[#94A3B8]">
                    {logs.length === 0
                      ? "No audit events recorded yet"
                      : "No events match your filters"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F1F5F9]">
            <span className="text-[12px] text-[#94A3B8]">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events
            </span>
            <div className="flex items-center gap-1">
              <button
                className="h-[30px] px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`h-[30px] w-[30px] rounded-md text-[12px] transition-colors ${
                      page === p
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="text-[12px] text-[#94A3B8] px-1">...</span>
                  <button
                    className={`h-[30px] w-[30px] rounded-md text-[12px] transition-colors ${
                      page === totalPages
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                className="h-[30px] px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
