"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, MapPin } from "lucide-react";
import { DeviceRangeFilters, useDeviceRange } from "@/components/filters/device-range-filters";
import type { RouteStop } from "@/lib/history";
import type { IdlePeriod, SpeedingEvent, Trip } from "@/lib/activity";

interface ActivityResponse {
  device: { id: string; name: string; vehiclePlate: string | null };
  trips: Omit<Trip, "firstIndex" | "lastIndex">[];
  stops: RouteStop[];
  idle: IdlePeriod[] | null;
  speeding: { limitKmh: number; events: SpeedingEvent[] };
  totals: {
    trips: number;
    distanceKm: number;
    drivingMin: number;
    stops: number;
    stoppedMin: number;
    idleMin: number | null;
    speedingEvents: number;
    maxSpeedKmh: number;
  };
}

type Tab = "trips" | "stops" | "idle" | "speeding";

interface Column {
  header: string;
  value: (row: Record<string, unknown>) => string | number;
}

// Margin around a row's period when opening it on the map, so the approach is visible
const MAP_MARGIN_MS = 2 * 60000;

const time = (iso: unknown) => new Date(String(iso)).toLocaleString();
const coords = (lat: unknown, lon: unknown) =>
  `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;

const COLUMNS: Record<Tab, Column[]> = {
  trips: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (min)", value: (r) => Number(r.durationMin) },
    { header: "Distance (km)", value: (r) => Number(r.distanceKm) },
    { header: "Distance from", value: (r) => (r.distanceSource === "roads" ? "roads" : "GPS") },
    { header: "Max speed (km/h)", value: (r) => Number(r.maxSpeedKmh) },
    { header: "Avg moving speed (km/h)", value: (r) => Number(r.avgMovingSpeedKmh) },
  ],
  stops: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (min)", value: (r) => Number(r.durationMin) },
    { header: "Address", value: (r) => String(r.address ?? "") },
    { header: "Location", value: (r) => coords(r.latitude, r.longitude) },
  ],
  idle: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (min)", value: (r) => Number(r.durationMin) },
    { header: "Location", value: (r) => coords(r.latitude, r.longitude) },
  ],
  speeding: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (s)", value: (r) => Number(r.durationSec) },
    { header: "GPS fixes", value: (r) => Number(r.fixes) },
    { header: "Max speed (km/h)", value: (r) => Number(r.maxSpeedKmh) },
    { header: "Location of max", value: (r) => coords(r.latitude, r.longitude) },
  ],
};

function toCsv(columns: Column[], rows: Record<string, unknown>[]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    columns.map((c) => escape(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(",")),
  ].join("\n");
}

export function ActivityReport() {
  const range = useDeviceRange();
  const [speedLimit, setSpeedLimit] = useState(80);
  const [report, setReport] = useState<ActivityResponse | null>(null);
  const [tab, setTab] = useState<Tab>("trips");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    if (!range.deviceId) return;
    setLoading(true);
    setError(null);
    const query = range.query();
    query.set("speedLimit", String(speedLimit));
    try {
      const res = await fetch(`/api/reports/activity?${query}`);
      const data = await res.json();
      if (!res.ok) {
        setReport(null);
        setError(data.error || "Could not load the report");
      } else {
        setReport(data);
      }
    } catch {
      setReport(null);
      setError("Could not load the report");
    } finally {
      setLoading(false);
    }
  }

  // Rows of the current tab; the columns above know each tab's fields
  const rows = (
    report
      ? tab === "trips"
        ? report.trips
        : tab === "stops"
          ? report.stops
          : tab === "idle"
            ? (report.idle ?? [])
            : report.speeding.events
      : []
  ) as unknown as Record<string, unknown>[];

  function mapLink(row: Record<string, unknown>) {
    const query = new URLSearchParams({
      history: "1",
      deviceId: report!.device.id,
      from: new Date(new Date(String(row.startTime)).getTime() - MAP_MARGIN_MS).toISOString(),
      to: new Date(new Date(String(row.endTime)).getTime() + MAP_MARGIN_MS).toISOString(),
    });
    return `/map?${query}`;
  }

  function downloadCsv() {
    if (!report) return;
    const blob = new Blob([toCsv(COLUMNS[tab], rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}-${report.device.name}-${range.from.slice(0, 10)}.csv`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  const t = report?.totals;

  return (
    <div className="space-y-4">
      <DeviceRangeFilters range={range} onSubmit={loadReport} loading={loading} submitLabel="Run report">
        <label className="flex flex-col gap-1 text-sm">
          Speed limit (km/h)
          <input
            type="number"
            min={10}
            max={200}
            value={speedLimit}
            onChange={(e) => setSpeedLimit(Number(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm w-28"
          />
        </label>
      </DeviceRangeFilters>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {report && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Trips", `${t.trips} · ${t.distanceKm} km`],
              ["Driving", `${t.drivingMin} min`],
              ["Stops", `${t.stops} · ${t.stoppedMin} min`],
              ["Idling", t.idleMin === null ? "No ignition data" : `${t.idleMin} min`],
              [`Over ${report.speeding.limitKmh} km/h`, String(t.speedingEvents)],
              ["Max speed", `${t.maxSpeedKmh} km/h`],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border rounded-lg px-4 py-3">
                <div className="text-xs text-zinc-500">{label}</div>
                <div className="text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border rounded-lg">
            <div className="flex items-center justify-between border-b px-2">
              <div className="flex">
                {(
                  [
                    ["trips", `Trips (${report.trips.length})`],
                    ["stops", `Stops (${report.stops.length})`],
                    ["idle", `Idling (${report.idle?.length ?? "—"})`],
                    ["speeding", `Speeding (${report.speeding.events.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-4 py-3 text-sm border-b-2 -mb-px ${
                      tab === key ? "border-zinc-900 font-medium" : "border-transparent text-zinc-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={downloadCsv}
                disabled={!rows.length}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-zinc-100 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>

            {tab === "idle" && report.idle === null ? (
              <p className="p-4 text-sm text-amber-700">
                This device doesn&apos;t report ignition, so idling can&apos;t be told apart from
                parking. Enable the ignition input on the tracker to get this report.
              </p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Nothing in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr>
                      {COLUMNS[tab].map((c) => (
                        <th key={c.header} className="px-4 py-2 font-normal whitespace-nowrap">
                          {c.header}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {COLUMNS[tab].map((c) => (
                          <td key={c.header} className="px-4 py-2 tabular-nums">
                            {c.value(row)}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={mapLink(row)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            View on map
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            Periods are measured between GPS reports, so durations can be short by up to one
            reporting interval. Stops: at or below 3 km/h for 3+ min. Idling: engine on and
            stopped for 2+ min. Trip distance follows the roads when it can be matched.
          </p>
        </>
      )}
    </div>
  );
}
