"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, Truck } from "lucide-react";
import type { DashboardSummary } from "@/lib/dashboard-data";

// Every figure on this page comes from /api/dashboard/summary (positions and alerts of the
// tenant's vehicles). While loading it shows "—"; if it fails it says so: never sample data.

const REFRESH_MS = 120_000;

/* ── tiny bar chart ───────────────────────────────────── */
function MiniBarChart({ data, labels, color = "#DBEAFE" }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[5px] h-12 mt-auto">
      {data.map((v, i) => (
        <div
          key={i}
          title={labels[i]}
          className="flex-1 rounded-t min-h-[2px]"
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

/* ── helpers ──────────────────────────────────────────── */
const km = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} km`;
const hours = (minutes: number) => `${(minutes / 60).toLocaleString("en-US", { maximumFractionDigits: 1 })} h`;
const shortDay = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function Change({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span className="text-[12px] text-[#94A3B8]">No data yesterday to compare</span>;
  const up = pct >= 0;
  return (
    <span className={`text-[12px] font-medium ${up ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
      {up ? "+" : ""}
      {pct}% <span className="text-[#94A3B8] font-normal">{label}</span>
    </span>
  );
}

const card = "bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col";

async function fetchSummary(): Promise<DashboardSummary> {
  const res = await fetch("/api/dashboard/summary");
  if (!res.ok) throw new Error("Could not load the dashboard");
  return res.json();
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [failed, setFailed] = useState(false);

  // State is set from the request's callback, not synchronously in the effect
  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetchSummary()
        .then((data) => {
          if (!active) return;
          setSummary(data);
          setFailed(false);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const s = summary;
  const dash = "—";
  const weekLabels = s?.week.map((d) => shortDay(d.date)) ?? [];
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      {failed && !s && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          The dashboard couldn&apos;t load. Figures will appear as soon as the server responds.
        </div>
      )}

      {/* ── TOP ROW ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[280px_1fr_1fr_260px] gap-6">
        {/* Today in one line */}
        <div className="bg-gradient-to-b from-[#1E40AF] to-[#3B82F6] rounded-2xl p-5 flex flex-col justify-between text-white">
          <div>
            <span className="text-[12px] text-white/70">{dateStr}</span>
            <h2 className="text-[20px] font-bold mt-1">Today</h2>
            <p className="text-[13px] text-white/80 mt-2 leading-relaxed">{s ? s.insight : "Loading today's activity…"}</p>
          </div>
          <Link href="/reports" className="text-[13px] font-semibold text-white underline underline-offset-2 self-start mt-3">
            Open reports
          </Link>
        </div>

        {/* Distance today */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#64748B]">Distance</span>
            <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded-md px-2 py-0.5">Today</span>
          </div>
          <p className="text-[36px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
            {s ? km(s.today.distanceKm) : dash}
          </p>
          {s && <Change pct={s.today.distanceVsYesterdayPct} label="vs yesterday" />}
          {s && <MiniBarChart data={s.week.map((d) => d.distanceKm)} labels={s.week.map((d, i) => `${weekLabels[i]}: ${km(d.distanceKm)}`)} />}
          <span className="text-[11px] text-[#94A3B8] mt-1">Last 7 days</span>
        </div>

        {/* Driving time today */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#64748B]">Driving time</span>
            <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded-md px-2 py-0.5">Today</span>
          </div>
          <p className="text-[36px] font-bold text-[#0F172A] tracking-tight tabular-nums mt-1">
            {s ? hours(s.today.drivingMin) : dash}
          </p>
          {s && <Change pct={s.today.drivingVsYesterdayPct} label="vs yesterday" />}
          {s && (
            <MiniBarChart
              data={s.week.map((d) => d.drivingMin)}
              labels={s.week.map((d, i) => `${weekLabels[i]}: ${hours(d.drivingMin)}`)}
              color="#DCFCE7"
            />
          )}
          <span className="text-[11px] text-[#94A3B8] mt-1">Last 7 days</span>
        </div>

        {/* Fleet right now */}
        <div className={`${card} items-center justify-center gap-2`}>
          <span className="text-[13px] text-[#64748B]">Reporting now</span>
          <DonutChart value={s?.vehicles.reporting ?? 0} total={s?.vehicles.total ?? 0} />
          <p className="text-[28px] font-bold text-[#0F172A] tracking-tight tabular-nums leading-none">
            {s ? `${s.vehicles.reporting} / ${s.vehicles.total}` : dash}
          </p>
          {s && (
            <span className="text-[12px] text-[#94A3B8] text-center">
              {s.vehicles.moving} moving · {s.vehicles.reporting - s.vehicles.moving} stopped ·{" "}
              {s.vehicles.notReporting} not reporting
            </span>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_260px] gap-6 flex-1 min-h-0">
        {/* Top vehicles today */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Top vehicles</h3>
            <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded-md px-2 py-0.5">Distance today</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {s && s.topVehicles.length === 0 && <p className="text-[13px] text-[#94A3B8] py-3">No vehicle has moved today.</p>}
            {s?.topVehicles.map((v) => (
              <Link
                key={v.id}
                href={`/map?${new URLSearchParams({ history: "1", deviceId: v.id, from: s.todayFrom, to: s.todayTo })}`}
                className="flex items-center gap-3 py-3 border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] -mx-2 px-2 rounded-lg"
              >
                <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F172A] truncate">{v.name}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {v.vehiclePlate ?? "No plate"} · {v.trips} trip{v.trips === 1 ? "" : "s"} · {hours(v.drivingMin)}
                  </p>
                </div>
                <span className="text-[13px] font-medium text-[#0F172A] tabular-nums">{km(v.distanceKm)}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity today */}
        <div className={`${card} gap-4`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#64748B]">Activity today</span>
            <Link href="/reports" className="text-[12px] text-[#2563EB] font-medium flex items-center gap-0.5 hover:underline">
              View details <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ["Trips", s ? String(s.today.trips) : dash],
              ["Stops", s ? String(s.today.stops) : dash],
              ["Vehicles that moved", s ? `${s.vehicles.movedToday} / ${s.vehicles.total}` : dash],
              ["Top speed", s ? `${Math.round(s.today.maxSpeedKmh)} km/h` : dash],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[24px] font-bold text-[#0F172A] tabular-nums">{value}</p>
                <p className="text-[12px] text-[#94A3B8]">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-auto">
            Distances follow the roads when the route can be matched. Trips and stops use the same rules as the reports.
          </p>
        </div>

        {/* Alerts today */}
        <div className={`${card} gap-3`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#64748B]">Alerts today</span>
            <Bell className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <p className="text-[36px] font-bold text-[#0F172A] tracking-tight tabular-nums leading-none">
            {s ? s.alertsToday.total : dash}
          </p>
          {s && (
            <ul className="text-[13px] text-[#64748B] space-y-1">
              <li className="flex justify-between"><span>Speeding</span><span className="tabular-nums text-[#0F172A]">{s.alertsToday.overspeed}</span></li>
              <li className="flex justify-between"><span>Geofence entries</span><span className="tabular-nums text-[#0F172A]">{s.alertsToday.geofenceEnter}</span></li>
              <li className="flex justify-between"><span>Geofence exits</span><span className="tabular-nums text-[#0F172A]">{s.alertsToday.geofenceExit}</span></li>
            </ul>
          )}
          <Link href="/alerts" className="text-[12px] text-[#2563EB] font-medium hover:underline mt-auto">
            {s && s.alertsToday.unread > 0 ? `${s.alertsToday.unread} unread · ` : ""}View alerts
          </Link>
        </div>
      </div>
    </div>
  );
}
