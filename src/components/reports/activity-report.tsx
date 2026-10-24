"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleParking, Clock, Download, FileChartColumn, Gauge, MapPin, Route, Timer, Zap } from "lucide-react";
import { DeviceRangeFilters, useDeviceRange } from "@/components/filters/device-range-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
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
  // Right-aligned figure
  numeric?: boolean;
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
    { header: "Duration (min)", value: (r) => Number(r.durationMin), numeric: true },
    { header: "Distance (km)", value: (r) => Number(r.distanceKm), numeric: true },
    { header: "Distance from", value: (r) => (r.distanceSource === "roads" ? "roads" : "GPS") },
    { header: "Max speed (km/h)", value: (r) => Number(r.maxSpeedKmh), numeric: true },
    { header: "Avg moving speed (km/h)", value: (r) => Number(r.avgMovingSpeedKmh), numeric: true },
  ],
  stops: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (min)", value: (r) => Number(r.durationMin), numeric: true },
    { header: "Address", value: (r) => String(r.address ?? "") },
    { header: "Location", value: (r) => coords(r.latitude, r.longitude) },
  ],
  idle: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (min)", value: (r) => Number(r.durationMin), numeric: true },
    { header: "Location", value: (r) => coords(r.latitude, r.longitude) },
  ],
  speeding: [
    { header: "Start", value: (r) => time(r.startTime) },
    { header: "End", value: (r) => time(r.endTime) },
    { header: "Duration (s)", value: (r) => Number(r.durationSec), numeric: true },
    { header: "GPS fixes", value: (r) => Number(r.fixes), numeric: true },
    { header: "Max speed (km/h)", value: (r) => Number(r.maxSpeedKmh), numeric: true },
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
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Trips, stops, idling and speeding for one vehicle and period"
        actions={
          report && (
            <Button variant="outline" onClick={downloadCsv} disabled={!rows.length}>
              <Download />
              Export CSV
            </Button>
          )
        }
      />

      <DeviceRangeFilters range={range} onSubmit={loadReport} loading={loading} submitLabel="Run report">
        <FormField label="Speed limit (km/h)">
          <Input
            type="number"
            min={10}
            max={200}
            value={speedLimit}
            onChange={(e) => setSpeedLimit(Number(e.target.value))}
            className="w-24"
          />
        </FormField>
      </DeviceRangeFilters>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !report && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[66px] rounded-xl" />
          ))}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="bg-card border rounded-xl py-16 text-center">
          <FileChartColumn className="size-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-foreground mt-3">No report yet</p>
          <p className="text-sm text-muted-foreground mt-1">Choose a vehicle and a period, then run the report.</p>
        </div>
      )}

      {report && t && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard icon={Route} label="Trips" value={t.trips} detail={`${t.distanceKm} km`} />
            <StatCard icon={Clock} label="Driving" value={`${t.drivingMin} min`} tone="green" />
            <StatCard icon={CircleParking} label="Stops" value={t.stops} detail={`${t.stoppedMin} min`} tone="slate" />
            <StatCard
              icon={Timer}
              label="Idling"
              value={t.idleMin === null ? "—" : `${t.idleMin} min`}
              detail={t.idleMin === null ? "no ignition data" : undefined}
              tone="amber"
            />
            <StatCard icon={Zap} label={`Over ${report.speeding.limitKmh} km/h`} value={t.speedingEvents} tone="red" />
            <StatCard icon={Gauge} label="Max speed" value={`${t.maxSpeedKmh} km/h`} tone="blue" />
          </div>

          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 pt-3 border-b">
              <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                <TabsList variant="line">
                  <TabsTrigger value="trips">Trips ({report.trips.length})</TabsTrigger>
                  <TabsTrigger value="stops">Stops ({report.stops.length})</TabsTrigger>
                  <TabsTrigger value="idle">Idling ({report.idle?.length ?? "—"})</TabsTrigger>
                  <TabsTrigger value="speeding">Speeding ({report.speeding.events.length})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {tab === "idle" && report.idle === null ? (
              <p className="p-5 text-sm text-amber-700">
                This vehicle&apos;s tracker doesn&apos;t report ignition, so idling can&apos;t be told apart
                from parking. Enable the ignition input on the tracker to get this report.
              </p>
            ) : rows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    {COLUMNS[tab].map((c) => (
                      <TableHead key={c.header} className={`text-xs text-muted-foreground px-4 ${c.numeric ? "text-right" : ""}`}>
                        {c.header}
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {COLUMNS[tab].map((c) => (
                        <TableCell key={c.header} className={`px-4 tabular-nums ${c.numeric ? "text-right" : ""}`}>
                          {c.value(row)}
                        </TableCell>
                      ))}
                      <TableCell className="px-4 text-right">
                        <Button asChild variant="ghost" size="sm" className="text-primary">
                          <Link href={mapLink(row)}>
                            <MapPin />
                            View on map
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Periods are measured between GPS reports, so durations can be short by up to one
            reporting interval. Stops: at or below 3 km/h for 3+ min. Idling: engine on and
            stopped for 2+ min. Trip distance follows the roads when it can be matched.
          </p>
        </>
      )}
    </div>
  );
}
