// Activity reports: trips, idling and speeding, derived from a device's positions.
// Pure functions shared by the reports API and its tests.

import { haversineKm, MAX_REPORT_GAP_MIN, STOP_MAX_SPEED_KMH, type RoutePoint, type RouteStop } from "@/lib/history";

export interface Trip {
  startTime: string;
  endTime: string;
  durationMin: number;
  start: [number, number];
  end: [number, number];
  // Between GPS fixes; the API replaces it with the road distance when it can match
  distanceKm: number;
  distanceSource: "roads" | "gps";
  maxSpeedKmh: number;
  avgMovingSpeedKmh: number;
  // Index range in the points array, inclusive
  firstIndex: number;
  lastIndex: number;
}

export interface IdlePeriod {
  startTime: string;
  endTime: string;
  durationMin: number;
  latitude: number;
  longitude: number;
}

export interface SpeedingEvent {
  startTime: string;
  endTime: string;
  // Between the first and last fix over the limit: 0 when only one fix was over it,
  // since the device reports every few seconds
  durationSec: number;
  fixes: number;
  maxSpeedKmh: number;
  latitude: number;
  longitude: number;
}

// Shorter "trips" are GPS jitter around a stop, not real movement
export const MIN_TRIP_DISTANCE_KM = 0.1;
// Engine on and not moving for at least this long counts as idling
export const IDLE_MIN_DURATION_MIN = 2;
export const DEFAULT_SPEED_LIMIT_KMH = 80;

// Trips are the movement between stops: a trip starts on the last fix of the previous stop
// (so the distance counts from where the vehicle was parked) and ends on the first fix of
// the next stop. Pauses shorter than a stop (traffic lights) stay inside the trip.
// A trip never spans more than MAX_REPORT_GAP_MIN without reports: what the vehicle did
// then is unknown, so it is split there and the gap counts as neither driving nor distance.
export function detectTrips(points: RoutePoint[], stops: Omit<RouteStop, "address">[]): Trip[] {
  if (points.length < 2) return [];

  const windows: [string, string][] = [];
  let from = points[0].time;
  for (const stop of stops) {
    if (stop.startTime > from) windows.push([from, stop.startTime]);
    from = stop.endTime;
  }
  const lastTime = points[points.length - 1].time;
  if (lastTime > from) windows.push([from, lastTime]);

  const trips: Trip[] = [];
  const addTrip = (firstIndex: number, lastIndex: number) => {
    if (lastIndex - firstIndex < 1) return;
    const run = points.slice(firstIndex, lastIndex + 1);
    const distanceKm = run.reduce((sum, p, i) => (i ? sum + haversineKm(run[i - 1], p) : 0), 0);
    if (distanceKm < MIN_TRIP_DISTANCE_KM) return;

    const moving = run.filter((p) => p.speedKmh > STOP_MAX_SPEED_KMH);
    const first = run[0];
    const last = run[run.length - 1];
    trips.push({
      startTime: first.time,
      endTime: last.time,
      durationMin: minutesBetween(first.time, last.time),
      start: [first.longitude, first.latitude],
      end: [last.longitude, last.latitude],
      distanceKm: round(distanceKm, 2),
      distanceSource: "gps",
      maxSpeedKmh: round(Math.max(...run.map((p) => p.speedKmh)), 1),
      avgMovingSpeedKmh: moving.length
        ? round(moving.reduce((sum, p) => sum + p.speedKmh, 0) / moving.length, 1)
        : 0,
      firstIndex,
      lastIndex,
    });
  };

  for (const [startTime, endTime] of windows) {
    const firstIndex = points.findIndex((p) => p.time >= startTime);
    if (firstIndex === -1) continue;
    let lastIndex = firstIndex;
    while (lastIndex + 1 < points.length && points[lastIndex + 1].time <= endTime) lastIndex++;

    // Split at gaps without reports
    let segmentStart = firstIndex;
    for (let i = firstIndex + 1; i <= lastIndex; i++) {
      if (minutesBetween(points[i - 1].time, points[i].time) > MAX_REPORT_GAP_MIN) {
        addTrip(segmentStart, i - 1);
        segmentStart = i;
      }
    }
    addTrip(segmentStart, lastIndex);
  }
  return trips;
}

// Engine on and not moving for at least IDLE_MIN_DURATION_MIN, from the first to the last
// fix observed idling (like stops). Null when the device never reports ignition: idling
// can't be told apart from parking without it.
export function detectIdle(points: RoutePoint[]): IdlePeriod[] | null {
  if (!points.some((p) => p.ignition !== null)) return null;

  const periods: IdlePeriod[] = [];
  let start = -1;
  const close = (end: number) => {
    const durationMin = minutesBetween(points[start].time, points[end].time);
    if (durationMin >= IDLE_MIN_DURATION_MIN) {
      periods.push({
        startTime: points[start].time,
        endTime: points[end].time,
        durationMin,
        latitude: points[start].latitude,
        longitude: points[start].longitude,
      });
    }
  };

  points.forEach((point, i) => {
    const idling = point.ignition === true && point.speedKmh <= STOP_MAX_SPEED_KMH;
    if (idling && start === -1) start = i;
    if (!idling && start !== -1) {
      close(i - 1);
      start = -1;
    }
  });
  if (start !== -1) close(points.length - 1);

  return periods;
}

// Runs of consecutive fixes above the limit
export function detectSpeeding(points: RoutePoint[], limitKmh: number): SpeedingEvent[] {
  const events: SpeedingEvent[] = [];
  let run: RoutePoint[] = [];
  const close = () => {
    if (!run.length) return;
    const peak = run.reduce((max, p) => (p.speedKmh > max.speedKmh ? p : max));
    events.push({
      startTime: run[0].time,
      endTime: run[run.length - 1].time,
      durationSec: Math.round(
        (new Date(run[run.length - 1].time).getTime() - new Date(run[0].time).getTime()) / 1000
      ),
      fixes: run.length,
      maxSpeedKmh: round(peak.speedKmh, 1),
      latitude: peak.latitude,
      longitude: peak.longitude,
    });
    run = [];
  };

  points.forEach((point) => {
    if (point.speedKmh > limitKmh) run.push(point);
    else close();
  });
  close();
  return events;
}

function minutesBetween(from: string, to: string): number {
  return round((new Date(to).getTime() - new Date(from).getTime()) / 60000, 1);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
