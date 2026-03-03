"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  Eye,
  ArrowUpRight,
  Truck,
} from "lucide-react";

/* ── tiny bar chart ───────────────────────────────────── */
function MiniBarChart({ data, color = "#DBEAFE" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[5px] h-12 mt-auto">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${(v / max) * 100}%`, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

/* ── donut chart (SVG) ────────────────────────────────── */
function DonutChart({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? value / total : 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#F1F5F9" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#2563EB"
        strokeWidth="10"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        className="transition-all duration-500"
      />
    </svg>
  );
}

/* ── safety gauge (SVG) ───────────────────────────────── */
function SafetyGauge({ score }: { score: number }) {
  const pct = Math.min(score / 10, 1);
  const r = 36;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="mx-auto">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#F1F5F9" strokeWidth="8" />
      <circle
        cx="45"
        cy="45"
        r={r}
        fill="none"
        stroke="#16A34A"
        strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 45 45)"
        className="transition-all duration-500"
      />
    </svg>
  );
}

/* ── mock data ────────────────────────────────────────── */
const topVehicles = [
  { plate: "#GH-44459-KC", model: "Toyota Hilux", km: 1512.7, color: "bg-[#2563EB]" },
  { plate: "#AP-35602-AZ", model: "Mercedes Actros", km: 1407.4, color: "bg-[#EF4444]" },
  { plate: "#NU-82307-DX", model: "Volvo FH16", km: 1206.2, color: "bg-[#F59E0B]" },
  { plate: "#JY-34844-IU", model: "Kenworth T680", km: 1142.1, color: "bg-[#16A34A]" },
  { plate: "#YU-49266-LG", model: "Scania R Series", km: 1123.9, color: "bg-[#EF4444]" },
  { plate: "#FF-23955-RG", model: "Mack Anthem", km: 987.7, color: "bg-[#F59E0B]" },
  { plate: "#SG-09924-HV", model: "DAF XF", km: 938.3, color: "bg-[#16A34A]" },
];

const barData1 = [20, 35, 15, 45, 60, 50, 70, 40, 55, 30, 25, 65];
const barData2 = [30, 15, 45, 25, 60, 35, 50, 20, 40, 55, 30, 45];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    activeDevices: 0,
    totalDistance: 0,
    totalVehicles: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/positions");
      if (res.ok) {
        const data = await res.json();
        setStats({
          activeDevices: data.length || 0,
          totalDistance: 48291,
          totalVehicles: data.length || 0,
        });
      }
    } catch {
      // fallback to mock data
      setStats({ activeDevices: 342, totalDistance: 48291, totalVehicles: 54 });
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ── TOP KPI ROW ──────────────────────────────── */}
      <div className="grid grid-cols-[280px_1fr_1fr_260px] gap-6">
        {/* Insights Card */}
        <div className="bg-gradient-to-b from-[#1E40AF] to-[#3B82F6] rounded-2xl p-5 flex flex-col justify-between text-white">
          <div>
            <span className="text-[12px] text-white/70">{dateStr}</span>
            <h2 className="text-[20px] font-bold mt-1">Insights</h2>
            <p className="text-[13px] text-white/70 mt-2 leading-relaxed">
              Fleet utilization increased by 8%, improving route efficiency and reducing idle time.
            </p>
          </div>
          <button className="text-[13px] font-semibold text-white underline underline-offset-2 self-start">
            View more insights
          </button>
        </div>

        {/* Active Devices */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#64748B]">Active Devices</span>
            <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded-md px-2 py-0.5">
              Today
            </span>
          </div>
          <p className="text-[36px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
            {stats.activeDevices || 342}
          </p>
          <span className="text-[12px] text-[#16A34A] font-medium">
            +12.5% <span className="text-[#94A3B8] font-normal">vs last month</span>
          </span>
          <MiniBarChart data={barData1} />
        </div>

        {/* Total Distance */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#64748B]">Total Distance</span>
            <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded-md px-2 py-0.5">
              Month
            </span>
          </div>
          <p className="text-[36px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
            {stats.totalDistance.toLocaleString()} km
          </p>
          <span className="text-[12px] text-[#16A34A] font-medium">
            +5.2% <span className="text-[#94A3B8] font-normal">vs last month</span>
          </span>
          <MiniBarChart data={barData2} />
        </div>

        {/* Fleet Status */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center gap-2">
          <span className="text-[13px] text-[#64748B]">Fleet Status</span>
          <DonutChart value={stats.activeDevices || 342} total={stats.totalVehicles || 54} />
          <p className="text-[28px] font-bold text-[#0F172A] tracking-tight tabular-nums leading-none">
            {stats.totalVehicles || 54}
          </p>
          <span className="text-[12px] text-[#94A3B8]">Total Vehicles</span>
        </div>
      </div>

      {/* ── BOTTOM ROW ───────────────────────────────── */}
      <div className="grid grid-cols-[320px_1fr_260px] gap-6 flex-1 min-h-0">
        {/* Top Vehicles */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Top Vehicles</h3>
            <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded-md px-2 py-0.5">
              Avg Distance
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="flex flex-col">
              {topVehicles.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 border-b border-[#F1F5F9] last:border-b-0"
                >
                  <div className={`w-8 h-8 ${v.color} rounded-lg flex items-center justify-center shrink-0`}>
                    <Truck className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A]">{v.plate}</p>
                    <p className="text-[11px] text-[#94A3B8]">{v.model}</p>
                  </div>
                  <span className="text-[13px] font-medium text-[#0F172A] tabular-nums">
                    {v.km.toLocaleString()} km
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column: Driving Distance + Driving Hours */}
        <div className="flex flex-col gap-6">
          {/* Driving Distance */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">Driving Distance</span>
              <button className="text-[12px] text-[#2563EB] font-medium flex items-center gap-0.5 hover:underline">
                View details <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[32px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
              1,462.7 km
            </p>
            <span className="text-[12px] text-[#94A3B8]">Avg Distance Driven</span>
            <MiniBarChart data={[25, 15, 40, 10, 55, 30, 45, 20, 35, 50, 25, 60]} />
          </div>

          {/* Driving Hours */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#64748B]">Driving Hours</span>
              <button className="text-[12px] text-[#2563EB] font-medium flex items-center gap-0.5 hover:underline">
                View details <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[32px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
              17.5 h
            </p>
            <span className="text-[12px] text-[#94A3B8]">Avg Hours Driven</span>
            <MiniBarChart data={[35, 20, 50, 30, 60, 25, 40, 15, 45, 55, 20, 35]} />
          </div>
        </div>

        {/* Right Column: Safety Score + Upsell */}
        <div className="flex flex-col gap-6">
          {/* Avg Safety Score */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col items-center justify-center gap-1">
            <span className="text-[13px] text-[#64748B]">Avg Safety Score</span>
            <SafetyGauge score={8.2} />
            <div className="flex items-baseline gap-0.5">
              <span className="text-[28px] font-bold text-[#0F172A] tracking-tight tabular-nums">
                8.2
              </span>
              <span className="text-[14px] text-[#94A3B8]">/10</span>
            </div>
          </div>

          {/* Upsell Card */}
          <div className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] rounded-2xl p-5 flex-1 flex flex-col justify-between text-white">
            <div>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-[15px] font-bold leading-tight">
                Elevate Your Tracking: Unlock Pro Features Today!
              </h3>
              <p className="text-[12px] text-white/70 mt-2 leading-relaxed">
                Get real-time insights, advanced analytics, and priority support with Pro.
              </p>
            </div>
            <button className="mt-3 h-[34px] rounded-lg bg-white text-[#1E40AF] text-[13px] font-semibold px-4 hover:bg-white/90 transition-colors self-start">
              Upgrade to Globo Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
