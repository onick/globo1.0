"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Zap,
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Stats {
  uptime: number;
  responseTime: number;
  dbConnections: number;
  dbMaxConnections: number;
  tenantCount: number;
  userCount: number;
  deviceCount: number;
  activeDevices: number;
}

interface ServiceStatus {
  name: string;
  status: string;
  uptime: number;
  responseTime: number;
}

const statusDotColor: Record<string, string> = {
  operational: "bg-[#16A34A]",
  degraded: "bg-[#F59E0B]",
  down: "bg-[#EF4444]",
};

const statusTextColor: Record<string, string> = {
  operational: "text-[#16A34A]",
  degraded: "text-[#F59E0B]",
  down: "text-[#EF4444]",
};

const statusLabel: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

export default function SystemHealthPage() {
  const [stats, setStats] = useState<Stats>({
    uptime: 0,
    responseTime: 0,
    dbConnections: 0,
    dbMaxConnections: 100,
    tenantCount: 0,
    userCount: 0,
    deviceCount: 0,
    activeDevices: 0,
  });
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchHealth = useCallback(() => {
    fetch("/api/admin/system-health")
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats);
        setServices(data.services);
        setLastRefresh(new Date());
      });
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const allOperational = services.every((s) => s.status === "operational");
  const dbPct = stats.dbMaxConnections > 0
    ? ((stats.dbConnections / stats.dbMaxConnections) * 100).toFixed(0)
    : "0";

  const kpis = [
    {
      label: "System Uptime",
      value: `${stats.uptime}%`,
      sub: "Last 30 days",
      subColor: "text-[#94A3B8]",
      valueColor: "text-[#16A34A]",
      icon: Activity,
      iconColor: "text-[#16A34A]",
      iconBg: "bg-[#F0FDF4]",
    },
    {
      label: "Avg Response Time",
      value: `${stats.responseTime}ms`,
      sub: "p50 latency",
      subColor: "text-[#94A3B8]",
      valueColor: "",
      icon: Zap,
      iconColor: "text-[#2563EB]",
      iconBg: "bg-[#EFF6FF]",
    },
    {
      label: "DB Connections",
      value: `${stats.dbConnections}/${stats.dbMaxConnections}`,
      sub: `${dbPct}% used`,
      subColor: "text-[#94A3B8]",
      valueColor: "",
      icon: Database,
      iconColor: "text-[#7C3AED]",
      iconBg: "bg-[#F5F3FF]",
    },
    {
      label: "Active Devices",
      value: stats.activeDevices,
      sub: `of ${stats.deviceCount} total`,
      subColor: "text-[#94A3B8]",
      valueColor: "text-[#16A34A]",
      icon: Server,
      iconColor: "text-[#16A34A]",
      iconBg: "bg-[#F0FDF4]",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">System Health</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Monitor platform infrastructure and services
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-1.5 h-[38px] rounded-lg border border-[#E2E8F0] bg-white px-4 text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#94A3B8]">{kpi.label}</span>
              <div
                className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center`}
              >
                <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
            </div>
            <p
              className={`text-[24px] font-bold tracking-tight tabular-nums mt-2 ${kpi.valueColor || "text-[#0F172A]"}`}
            >
              {kpi.value}
            </p>
            <span className={`text-[12px] ${kpi.subColor}`}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Services Status */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Service Status</h3>
            <div className="flex items-center gap-1.5">
              {allOperational ? (
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              )}
              <span
                className={`text-[12px] font-medium ${allOperational ? "text-[#16A34A]" : "text-[#F59E0B]"}`}
              >
                {allOperational ? "All Systems Operational" : "Some Issues Detected"}
              </span>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9]">
                {["Service", "Status", "Uptime", "Response"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr
                  key={svc.name}
                  className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] font-medium text-[#0F172A]">
                    {svc.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${statusDotColor[svc.status] || "bg-[#16A34A]"}`}
                      />
                      <span
                        className={`text-[12px] font-medium ${statusTextColor[svc.status] || "text-[#16A34A]"}`}
                      >
                        {statusLabel[svc.status] || svc.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[#0F172A] tabular-nums">
                    {svc.uptime}%
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-[#94A3B8] tabular-nums">
                    {svc.responseTime}ms
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8">
                    <p className="text-[13px] text-[#94A3B8]">Loading services...</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Platform Overview */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">Platform Overview</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">Tenants</span>
              <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums">
                {stats.tenantCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">Users</span>
              <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums">
                {stats.userCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">Total Devices</span>
              <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums">
                {stats.deviceCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">Active Devices</span>
              <span className="text-[13px] font-semibold text-[#16A34A] tabular-nums">
                {stats.activeDevices}
              </span>
            </div>

            <div className="h-px bg-[#F1F5F9]" />

            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">DB Pool Usage</span>
              <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums">
                {stats.dbConnections}/{stats.dbMaxConnections}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all"
                style={{
                  width: `${stats.dbMaxConnections > 0 ? (stats.dbConnections / stats.dbMaxConnections) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#F1F5F9]">
            <span className="text-[12px] text-[#94A3B8]">
              Last refreshed:{" "}
              {lastRefresh.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
