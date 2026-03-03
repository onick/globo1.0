"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Cpu,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalDevices: number;
  activeDevices: number;
  totalUsers: number;
  monthlyRevenue: number;
  systemUptime: number;
}

interface TopTenant {
  id: string;
  name: string;
  status: string;
  _count: { devices: number };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    activeTenants: 0,
    totalDevices: 0,
    activeDevices: 0,
    totalUsers: 0,
    monthlyRevenue: 0,
    systemUptime: 99.8,
  });
  const [topTenants, setTopTenants] = useState<TopTenant[]>([]);

  const fetchData = useCallback(async () => {
    const [tenantsRes, plansRes, usersRes] = await Promise.all([
      fetch("/api/admin/tenants").then((r) => r.json()),
      fetch("/api/admin/plans").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);

    const tenants = tenantsRes as TopTenant[];
    const activeTenants = tenants.filter((t) => t.status === "active").length;
    const totalDevices = tenants.reduce((sum, t) => sum + t._count.devices, 0);

    setStats({
      totalTenants: tenants.length,
      activeTenants,
      totalDevices,
      activeDevices: totalDevices,
      totalUsers: usersRes.stats?.total ?? 0,
      monthlyRevenue: plansRes.stats?.monthlyRevenue ?? 0,
      systemUptime: 99.8,
    });

    setTopTenants(
      [...tenants]
        .sort((a: TopTenant, b: TopTenant) => b._count.devices - a._count.devices)
        .slice(0, 7)
    );
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = [
    {
      label: "Active Tenants",
      value: stats.activeTenants,
      total: stats.totalTenants,
      icon: Building2,
      color: "text-[#7C3AED]",
      bgColor: "bg-[#F3E8FF]",
    },
    {
      label: "Monthly Revenue",
      value: `$${(stats.monthlyRevenue / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-[#16A34A]",
      bgColor: "bg-[#F0FDF4]",
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-[#2563EB]",
      bgColor: "bg-[#DBEAFE]",
    },
    {
      label: "System Uptime",
      value: `${stats.systemUptime}%`,
      icon: TrendingUp,
      color: "text-[#16A34A]",
      bgColor: "bg-[#F0FDF4]",
    },
  ];

  const statusColor: Record<string, string> = {
    active: "bg-[#16A34A]",
    trial: "bg-[#F59E0B]",
    suspended: "bg-[#EF4444]",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-[12px] text-[#94A3B8] uppercase tracking-wider mb-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <h1 className="text-[20px] font-semibold text-[#0F172A]">
          Platform Insights
        </h1>
        <p className="text-[13px] text-[#64748B] mt-0.5">
          Global metrics across all tenants and services
        </p>
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
                className={`w-8 h-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}
              >
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-[24px] font-bold text-[#0F172A] tracking-tight tabular-nums">
                {kpi.value}
              </p>
              {"total" in kpi && kpi.total !== undefined && (
                <span className="text-[12px] text-[#94A3B8]">
                  / {kpi.total} total
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Tenants */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Top Tenants</h3>
            <span className="text-[12px] text-[#94A3B8]">By devices</span>
          </div>
          <div className="flex flex-col gap-3">
            {topTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${statusColor[tenant.status] || "bg-[#16A34A]"}`}
                  />
                  <span className="text-[13px] font-medium text-[#0F172A]">{tenant.name}</span>
                </div>
                <span className="text-[12px] text-[#94A3B8] tabular-nums">
                  {tenant._count.devices} devices
                </span>
              </div>
            ))}
            {topTenants.length === 0 && (
              <p className="text-[12px] text-[#94A3B8] text-center py-4">
                No tenants yet
              </p>
            )}
          </div>
        </div>

        {/* Device Growth */}
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Device Growth</h3>
            <a href="/admin/devices" className="text-[12px] text-[#2563EB] flex items-center gap-0.5 hover:underline font-medium">
              View all <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-[28px] font-bold text-[#0F172A] tracking-tight tabular-nums">
              {stats.totalDevices.toLocaleString()}
            </p>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-1">
            Total devices across all tenants
          </p>
          <div className="flex items-end gap-1 mt-4 h-20">
            {[35, 45, 30, 55, 70, 60, 80, 65, 90, 75, 85, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-[#DBEAFE] rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* System Monitoring Card */}
        <div className="bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] lg:col-span-1">
          <h3 className="text-[15px] font-semibold text-white/90">
            System Monitoring & Alerts
          </h3>
          <p className="text-[13px] text-white/60 mt-2">
            Configure real-time alerts for device status, geofence violations, and security events.
          </p>
          <div className="mt-auto pt-6">
            <a
              href="/admin/settings"
              className="inline-flex items-center h-[34px] rounded-lg bg-white/20 border border-white/20 px-4 text-[13px] font-medium text-white hover:bg-white/30 transition-colors"
            >
              Configure Alerts
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
