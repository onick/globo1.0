"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { RouteMap } from "@/components/history/route-map";
import type { RoutePoint, RouteStop, RouteSummary } from "@/lib/history";

interface DeviceOption {
  id: string;
  name: string;
  vehiclePlate: string | null;
  traccarId: number | null;
}

interface HistoryResponse {
  points: RoutePoint[];
  stops: RouteStop[];
  summary: RouteSummary;
}

const PLAYBACK_SPEEDS = [1, 2, 4, 8];
const BASE_STEP_MS = 400;

// "YYYY-MM-DDTHH:mm" in local time, the format datetime-local inputs use
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function presetRange(preset: "today" | "yesterday" | "week") {
  const now = new Date();
  if (preset === "today") return { from: startOfDay(now), to: now };
  if (preset === "yesterday") {
    const to = startOfDay(now);
    return { from: new Date(to.getTime() - 24 * 3600 * 1000), to };
  }
  return { from: new Date(now.getTime() - 7 * 24 * 3600 * 1000), to: now };
}

export function RouteHistory() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [from, setFrom] = useState(() => toLocalInput(presetRange("today").from));
  const [to, setTo] = useState(() => toLocalInput(presetRange("today").to));
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    fetch("/api/devices")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DeviceOption[]) => {
        const linked = data.filter((d) => d.traccarId);
        setDevices(linked);
        if (linked.length) setDeviceId(linked[0].id);
      });
  }, []);

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

  function applyPreset(preset: "today" | "yesterday" | "week") {
    const range = presetRange(preset);
    setFrom(toLocalInput(range.from));
    setTo(toLocalInput(range.to));
  }

  async function loadHistory() {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setIndex(0);

    const query = new URLSearchParams({
      deviceId,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
    try {
      const res = await fetch(`/api/history?${query}`);
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

  function togglePlay() {
    if (!points.length) return;
    if (index >= points.length - 1) setIndex(0);
    setPlaying((p) => !p);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex flex-wrap items-end gap-3 bg-white border rounded-lg p-4">
        <label className="flex flex-col gap-1 text-sm">
          Device
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm min-w-48"
          >
            {devices.length === 0 && <option value="">No linked devices</option>}
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.vehiclePlate ? ` · ${d.vehiclePlate}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          From
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-1">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "Last 7 days"],
            ] as const
          ).map(([preset, label]) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className="px-3 py-2 border rounded-md text-sm hover:bg-zinc-100"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={loadHistory}
          disabled={!deviceId || loading}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Show route"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {history && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Distance", `${history.summary.distanceKm} km`],
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

      <div className="relative flex-1 min-h-80">
        <RouteMap points={points} stops={history?.stops ?? []} currentIndex={index} />
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
