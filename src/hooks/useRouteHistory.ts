"use client";

import { useState, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────── */

export interface HistoryPosition {
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  fixTime: string;
  attributes: {
    ignition?: boolean;
    motion?: boolean;
    totalDistance?: number;
    [key: string]: unknown;
  };
}

export interface RouteSegment {
  type: "moving" | "stopped";
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

/* ── Haversine distance ────────────────────────────────── */

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── GPS Noise Filter ──────────────────────────────────── */

/**
 * Douglas-Peucker line simplification algorithm.
 * Removes redundant points that don't contribute to the shape of the path.
 * epsilon = tolerance in km (smaller = more detail kept)
 */
function perpendicularDistKm(
  point: HistoryPosition,
  lineStart: HistoryPosition,
  lineEnd: HistoryPosition
): number {
  // Use cross-track distance on great circle (simplified for short distances)
  const dAP = haversineKm(lineStart.latitude, lineStart.longitude, point.latitude, point.longitude);
  const dAB = haversineKm(lineStart.latitude, lineStart.longitude, lineEnd.latitude, lineEnd.longitude);
  if (dAB < 0.0001) return dAP; // start==end, just return distance to point

  const bearingAB = Math.atan2(
    Math.sin((lineEnd.longitude - lineStart.longitude) * Math.PI / 180) *
      Math.cos(lineEnd.latitude * Math.PI / 180),
    Math.cos(lineStart.latitude * Math.PI / 180) * Math.sin(lineEnd.latitude * Math.PI / 180) -
      Math.sin(lineStart.latitude * Math.PI / 180) * Math.cos(lineEnd.latitude * Math.PI / 180) *
      Math.cos((lineEnd.longitude - lineStart.longitude) * Math.PI / 180)
  );
  const bearingAP = Math.atan2(
    Math.sin((point.longitude - lineStart.longitude) * Math.PI / 180) *
      Math.cos(point.latitude * Math.PI / 180),
    Math.cos(lineStart.latitude * Math.PI / 180) * Math.sin(point.latitude * Math.PI / 180) -
      Math.sin(lineStart.latitude * Math.PI / 180) * Math.cos(point.latitude * Math.PI / 180) *
      Math.cos((point.longitude - lineStart.longitude) * Math.PI / 180)
  );

  return Math.abs(Math.asin(Math.sin(dAP / 6371) * Math.sin(bearingAP - bearingAB)) * 6371);
}

function douglasPeucker(
  points: HistoryPosition[],
  epsilon: number
): HistoryPosition[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line (first→last)
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistKm(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // If max distance exceeds epsilon, recursively simplify both halves
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise, discard all intermediate points (keep first & last)
  return [points[0], points[points.length - 1]];
}

/**
 * Collapse stopped positions to centroid.
 * When the vehicle is parked, GPS drift creates noise — we replace all
 * those drifting points with a single stable centroid position.
 */
function collapseStoppedPositions(positions: HistoryPosition[]): HistoryPosition[] {
  if (positions.length <= 1) return positions;

  const centroidLat = positions.reduce((s, p) => s + p.latitude, 0) / positions.length;
  const centroidLon = positions.reduce((s, p) => s + p.longitude, 0) / positions.length;

  // Keep first and last (for timeline continuity) but pin them to centroid
  // Also keep a few intermediate points for playback smoothness
  const result: HistoryPosition[] = [];
  const step = Math.max(1, Math.floor(positions.length / 3)); // keep ~3 points

  for (let i = 0; i < positions.length; i += step) {
    result.push({
      ...positions[i],
      latitude: centroidLat,
      longitude: centroidLon,
    });
  }

  // Always include the last point
  const last = positions[positions.length - 1];
  if (result[result.length - 1].fixTime !== last.fixTime) {
    result.push({
      ...last,
      latitude: centroidLat,
      longitude: centroidLon,
    });
  }

  return result;
}

// Simplification thresholds
const SIMPLIFY_EPSILON_MOVING = 0.015; // 15 meters — removes GPS wobble but keeps real turns

/* ── Processing ────────────────────────────────────────── */

const STOP_SPEED = 2;          // km/h
const MIN_STOP_DURATION = 60_000; // 1 minute

function processPositions(positions: HistoryPosition[]) {
  if (positions.length === 0) {
    return { segments: [], stops: [], summary: null };
  }

  // 1. Classify each position
  const classified = positions.map((p) => ({
    ...p,
    isMoving: p.speed >= STOP_SPEED,
  }));

  // 2. Build raw segments of consecutive same-type positions
  const rawSegments: { type: "moving" | "stopped"; positions: typeof classified }[] = [];
  let currentType: "moving" | "stopped" = classified[0].isMoving ? "moving" : "stopped";
  let currentGroup = [classified[0]];

  for (let i = 1; i < classified.length; i++) {
    const type = classified[i].isMoving ? "moving" : "stopped";
    if (type === currentType) {
      currentGroup.push(classified[i]);
    } else {
      rawSegments.push({ type: currentType, positions: currentGroup });
      currentType = type;
      currentGroup = [classified[i]];
    }
  }
  rawSegments.push({ type: currentType, positions: currentGroup });

  // 3. Merge brief stopped segments (< MIN_STOP_DURATION) into moving
  const mergedSegments: typeof rawSegments = [];
  for (const seg of rawSegments) {
    if (seg.type === "stopped") {
      const start = new Date(seg.positions[0].fixTime).getTime();
      const end = new Date(seg.positions[seg.positions.length - 1].fixTime).getTime();
      if (end - start < MIN_STOP_DURATION && mergedSegments.length > 0) {
        // Merge into previous segment
        const prev = mergedSegments[mergedSegments.length - 1];
        prev.positions.push(...seg.positions);
        continue;
      }
    }
    mergedSegments.push(seg);
  }

  // 4. Build RouteSegments with stats + GPS noise filtering
  const segments: RouteSegment[] = mergedSegments.map((seg) => {
    const startTime = seg.positions[0].fixTime;
    const endTime = seg.positions[seg.positions.length - 1].fixTime;
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    // Calculate stats on RAW positions (before filtering) for accuracy
    let distance = 0;
    let maxSpeed = 0;
    for (let i = 1; i < seg.positions.length; i++) {
      const prev = seg.positions[i - 1];
      const curr = seg.positions[i];
      distance += haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      if (curr.speed > maxSpeed) maxSpeed = curr.speed;
    }

    const avgSpeed = duration > 0 ? (distance / (duration / 3600000)) : 0;

    // Apply GPS noise filter to positions for DISPLAY
    let cleanPositions: HistoryPosition[];
    if (seg.type === "stopped") {
      // Collapse all drifting stopped positions to centroid
      cleanPositions = collapseStoppedPositions(seg.positions);
    } else {
      // Simplify moving path with Douglas-Peucker
      cleanPositions = douglasPeucker(seg.positions, SIMPLIFY_EPSILON_MOVING);
    }

    return {
      type: seg.type,
      positions: cleanPositions,
      startTime,
      endTime,
      distance,
      maxSpeed,
      avgSpeed: seg.type === "moving" ? avgSpeed : 0,
      color: seg.type === "moving" ? "#16A34A" : "#F59E0B",
    };
  });

  // 5. Extract stops
  const stops: StopEvent[] = segments
    .filter((s) => s.type === "stopped")
    .map((s) => {
      // Use centroid of stopped positions
      const lats = s.positions.map((p) => p.latitude);
      const lngs = s.positions.map((p) => p.longitude);
      return {
        latitude: lats.reduce((a, b) => a + b, 0) / lats.length,
        longitude: lngs.reduce((a, b) => a + b, 0) / lngs.length,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: new Date(s.endTime).getTime() - new Date(s.startTime).getTime(),
      };
    });

  // 6. Summary
  const totalDuration =
    new Date(positions[positions.length - 1].fixTime).getTime() -
    new Date(positions[0].fixTime).getTime();

  const movingSegs = segments.filter((s) => s.type === "moving");
  const stoppedSegs = segments.filter((s) => s.type === "stopped");

  const movingDuration = movingSegs.reduce(
    (acc, s) => acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()),
    0
  );
  const stoppedDuration = stoppedSegs.reduce(
    (acc, s) => acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()),
    0
  );

  const totalDistance = movingSegs.reduce((acc, s) => acc + s.distance, 0);
  const maxSpeed = Math.max(0, ...segments.map((s) => s.maxSpeed));
  const avgSpeed = movingDuration > 0 ? (totalDistance / (movingDuration / 3600000)) : 0;

  const summary: TripSummary = {
    totalDistance,
    totalDuration,
    movingDuration,
    stoppedDuration,
    maxSpeed,
    avgSpeed,
    stopCount: stops.length,
  };

  return { segments, stops, summary };
}

/* ── Hook ──────────────────────────────────────────────── */

export function useRouteHistory() {
  const [positions, setPositions] = useState<HistoryPosition[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [stops, setStops] = useState<StopEvent[]>([]);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (deviceId: string, from: Date, to: Date) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/positions/history?deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}`
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: HistoryPosition[] = await res.json();

      if (data.length === 0) {
        setPositions([]);
        setSegments([]);
        setStops([]);
        setSummary(null);
        setError("No movement data found for this period");
        return;
      }

      const result = processPositions(data);
      setPositions(data);
      setSegments(result.segments);
      setStops(result.stops);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPositions([]);
    setSegments([]);
    setStops([]);
    setSummary(null);
    setLoading(false);
    setError(null);
  }, []);

  return { positions, segments, stops, summary, loading, error, fetchHistory, clear };
}
