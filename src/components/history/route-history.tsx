"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pause, Play, RotateCcw } from "lucide-react";
import { RouteMap } from "@/components/history/route-map";
import { DeviceRangeFilters, useDeviceRange } from "@/components/filters/device-range-filters";
import type { RoutePoint, RouteStop, RouteSummary } from "@/lib/history";

interface HistoryResponse {
  points: RoutePoint[];
  stops: RouteStop[];
  route: { snappedToRoads: boolean; segments: [number, number][][] } | null;
  summary: RouteSummary;
}

const PLAYBACK_SPEEDS = [1, 2, 4, 8];
const BASE_STEP_MS = 400;

export function RouteHistory() {
  // ?deviceId=&from=&to= (e.g. from a report row) opens that period directly
  const searchParams = useSearchParams();
  const range = useDeviceRange({
    deviceId: searchParams.get("deviceId"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [snapToRoads, setSnapToRoads] = useState(true);
  const [showGpsPoints, setShowGpsPoints] = useState(false);

  const points = history?.points ?? [];
  const current = points[index];

  // Playback loop: one point per step, faster at higher speeds
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= points.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, BASE_STEP_MS / speed);
    return () => clearInterval(timer);
  }, [playing, speed, points.length]);

  async function loadHistory() {
    if (!range.deviceId) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setIndex(0);

    try {
      const res = await fetch(`/api/history?${range.query()}`);
      const data = await res.json();
      if (!res.ok) {
        setHistory(null);
        setError(data.error || "Could not load history");
      } else {
        setHistory(data);
      }
    } catch {
      setHistory(null);
      setError("Could not load history");
    } finally {
      setLoading(false);
    }
  }

  // Opened from a link with a device and period: load it once the devices are known
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !range.devicesLoaded || !searchParams.get("deviceId")) return;
    autoLoaded.current = true;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.devicesLoaded]);

  function togglePlay() {
    if (!points.length) return;
    if (index >= points.length - 1) setIndex(0);
    setPlaying((p) => !p);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <DeviceRangeFilters
        range={range}
        onSubmit={loadHistory}
        loading={loading}
        submitLabel="Show route"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {history && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            [
              history.summary.distanceSource === "roads" ? "Distance (roads)" : "Distance (GPS)",
              `${history.summary.distanceKm} km`,
            ],
            ["Duration", `${history.summary.durationMin} min`],
            ["Max speed", `${history.summary.maxSpeedKmh} km/h`],
            ["Avg moving speed", `${history.summary.avgMovingSpeedKmh} km/h`],
            ["Stops", String(history.stops.length)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border rounded-lg px-4 py-3">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="text-lg font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}

      {history && points.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={snapToRoads}
              disabled={!history.route}
              onChange={(e) => setSnapToRoads(e.target.checked)}
            />
            Snap to roads
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showGpsPoints}
              onChange={(e) => setShowGpsPoints(e.target.checked)}
            />
            Show GPS points ({points.length})
          </label>
          {!history.route && (
            <span className="text-amber-700">
              Road matching unavailable: the line joins GPS fixes and may cut corners.
            </span>
          )}
          {history.route && (
            <span className="text-zinc-500">
              Straight lines between GPS fixes: {history.summary.gpsDistanceKm} km
            </span>
          )}
        </div>
      )}

      <div className="relative flex-1 min-h-80">
        <RouteMap
          points={points}
          stops={history?.stops ?? []}
          segments={history?.route?.segments ?? null}
          snapToRoads={snapToRoads}
          showGpsPoints={showGpsPoints}
          currentIndex={index}
        />
        {history && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white px-4 py-2 rounded-md shadow text-sm">
              No positions in this range
            </div>
          </div>
        )}
      </div>

      {points.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="p-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
            aria-label="Restart"
            className="p-2 border rounded-md hover:bg-zinc-100"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Playback speed"
            className="border rounded-md px-2 py-2 text-sm"
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            aria-label="Playback position"
            className="flex-1 min-w-40"
          />
          {current && (
            <div className="text-sm text-zinc-600 tabular-nums">
              {new Date(current.time).toLocaleString()} · {Math.round(current.speedKmh)} km/h
            </div>
          )}
        </div>
      )}
    </div>
  );
}
