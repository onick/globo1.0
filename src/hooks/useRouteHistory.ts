"use client";

import { useState, useCallback } from "react";
import type { RoutePoint, RouteStop, RouteSummary } from "@/lib/history";
import { haversineKm } from "@/lib/history";
import { lengthKm, locateOnLine, pathBetween, type PathLocation } from "@/lib/route-path";
import { buildTrack, type TrackPoint } from "@/lib/playback";

// The history is computed on the server (/api/history): positions in km/h, stops with the
// same rules as the reports and alerts, and the route snapped to the roads when OSRM is
// available. This hook only shapes it into moving/stopped segments for the map and panel.

/* ── Types ─────────────────────────────────────────────── */

export interface HistoryPosition {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  course: number;
  fixTime: string;
  attributes: {
    ignition?: boolean;
    [key: string]: unknown;
  };
}

export interface RouteSegment {
  type: "moving" | "stopped";
  // Points to draw: along the roads when the route was matched
  positions: HistoryPosition[];
  startTime: string;
  endTime: string;
  distance: number;  // km
  maxSpeed: number;  // km/h
  avgSpeed: number;  // km/h
  color: string;
}

export interface StopEvent {
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  duration: number; // ms
}

export interface TripSummary {
  totalDistance: number;   // km
  totalDuration: number;  // ms
  movingDuration: number; // ms
  stoppedDuration: number; // ms
  maxSpeed: number;       // km/h
  avgSpeed: number;       // km/h (over moving time)
  stopCount: number;
}

interface HistoryResponse {
  points: RoutePoint[];
  stops: RouteStop[];
  route: { snappedToRoads: boolean; segments: [number, number][][] } | null;
  summary: RouteSummary;
}

type LngLat = [number, number];

const MOVING_COLOR = "#16A34A";
const STOPPED_COLOR = "#F59E0B";

const ms = (iso: string) => new Date(iso).getTime();

/* ── Shaping ───────────────────────────────────────────── */

export function shapeHistory(data: HistoryResponse) {
  const positions: HistoryPosition[] = data.points.map((p) => ({
    latitude: p.snapped ? p.snapped[1] : p.latitude,
    longitude: p.snapped ? p.snapped[0] : p.longitude,
    speed: p.speedKmh,
    course: p.course,
    fixTime: p.time,
    attributes: p.ignition === null ? {} : { ignition: p.ignition },
  }));

  // Road-matched line and where each fix sits on it, to draw stretches along the streets
  const line: LngLat[] | null = data.route ? data.route.segments.flat() : null;
  const locations: PathLocation[] | null = line
    ? locateOnLine(line, positions.map((p) => [p.longitude, p.latitude]))
    : null;

  const pathFor = (first: number, last: number): HistoryPosition[] => {
    if (!line || !locations) return positions.slice(first, last + 1);
    const out: HistoryPosition[] = [];
    for (let i = first; i < last; i++) {
      pathBetween(line, locations[i], locations[i + 1])
        .slice(i === first ? 0 : 1)
        .forEach(([longitude, latitude]) => out.push({ ...positions[i], latitude, longitude }));
    }
    if (first === last) out.push(positions[first]);
    return out;
  };

  const distanceOf = (first: number, last: number, path: HistoryPosition[]) =>
    line
      ? lengthKm(path.map((p) => [p.longitude, p.latitude]))
      : positions
          .slice(first, last + 1)
          .reduce((sum, p, i, run) => (i ? sum + haversineKm(run[i - 1], p) : 0), 0);

  // Index range of each stop; moving segments are what lies between them
  const indexOf = (time: string, fromStart: boolean) => {
    const t = ms(time);
    if (fromStart) return Math.max(0, data.points.findIndex((p) => ms(p.time) >= t));
    let i = data.points.length - 1;
    while (i > 0 && ms(data.points[i].time) > t) i--;
    return i;
  };

  const segments: RouteSegment[] = [];
  const moving = (first: number, last: number) => {
    if (last <= first) return;
    const path = pathFor(first, last);
    const distance = distanceOf(first, last, path);
    const hours = (ms(positions[last].fixTime) - ms(positions[first].fixTime)) / 3_600_000;
    segments.push({
      type: "moving",
      positions: path,
      startTime: positions[first].fixTime,
      endTime: positions[last].fixTime,
      distance,
      maxSpeed: Math.max(...positions.slice(first, last + 1).map((p) => p.speed)),
      avgSpeed: hours > 0 ? distance / hours : 0,
      color: MOVING_COLOR,
    });
  };

  let cursor = 0;
  for (const stop of data.stops) {
    const first = indexOf(stop.startTime, true);
    const last = indexOf(stop.endTime, false);
    moving(cursor, first);
    segments.push({
      type: "stopped",
      // A parked vehicle's fixes drift; draw it where the stop is
      positions: positions.slice(first, last + 1).map((p) => ({
        ...p,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
      startTime: stop.startTime,
      endTime: stop.endTime,
      distance: 0,
      maxSpeed: Math.max(...positions.slice(first, last + 1).map((p) => p.speed)),
      avgSpeed: 0,
      color: STOPPED_COLOR,
    });
    cursor = last;
  }
  moving(cursor, positions.length - 1);

  const stops: StopEvent[] = data.stops.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
    startTime: s.startTime,
    endTime: s.endTime,
    duration: ms(s.endTime) - ms(s.startTime),
  }));

  const span = (s: RouteSegment) => ms(s.endTime) - ms(s.startTime);
  const movingDuration = segments.filter((s) => s.type === "moving").reduce((a, s) => a + span(s), 0);

  const summary: TripSummary = {
    totalDistance: data.summary.distanceKm,
    totalDuration:
      positions.length > 1 ? ms(positions[positions.length - 1].fixTime) - ms(positions[0].fixTime) : 0,
    movingDuration,
    stoppedDuration: stops.reduce((a, s) => a + s.duration, 0),
    maxSpeed: data.summary.maxSpeedKmh,
    avgSpeed: movingDuration > 0 ? data.summary.distanceKm / (movingDuration / 3_600_000) : 0,
    stopCount: stops.length,
  };

  // Timed points for playback, along the roads between consecutive fixes
  const track = buildTrack(
    positions.map((p) => ({ time: ms(p.fixTime), longitude: p.longitude, latitude: p.latitude, speed: p.speed, course: p.course })),
    line && locations ? positions.slice(1).map((_, i) => pathBetween(line, locations[i], locations[i + 1])) : null
  );

  return { positions, segments, stops, summary, baseLine: line, track };
}

/* ── Hook ──────────────────────────────────────────────── */

export function useRouteHistory() {
  const [positions, setPositions] = useState<HistoryPosition[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [stops, setStops] = useState<StopEvent[]>([]);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  // Whole route along the roads; null when it couldn't be matched (GPS line instead)
  const [baseLine, setBaseLine] = useState<LngLat[] | null>(null);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPositions([]);
    setSegments([]);
    setStops([]);
    setSummary(null);
    setBaseLine(null);
    setTrack([]);
  }, []);

  const fetchHistory = useCallback(async (deviceId: string, from: Date, to: Date) => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ deviceId, from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`/api/history?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.points.length === 0) {
        reset();
        setError("No movement data found for this period");
        return;
      }

      const shaped = shapeHistory(data);
      setPositions(shaped.positions);
      setSegments(shaped.segments);
      setStops(shaped.stops);
      setSummary(shaped.summary);
      setBaseLine(shaped.baseLine);
      setTrack(shaped.track);
    } catch (err) {
      reset();
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  const clear = useCallback(() => {
    reset();
    setLoading(false);
    setError(null);
  }, [reset]);

  return { positions, segments, stops, summary, baseLine, track, loading, error, fetchHistory, clear };
}
