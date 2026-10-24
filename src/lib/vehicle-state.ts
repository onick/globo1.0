import { detectStops, haversineKm, STOP_MAX_SPEED_KMH, type RoutePoint } from "@/lib/history";

// What a vehicle is doing according to its last report, and since when: moving since it
// left its last stop, stopped since it arrived. Also the distance of the trip in progress
// (0 while stopped). Points are the vehicle's recent fixes in time order.
export function currentState(points: RoutePoint[]): { moving: boolean; since: string; currentTripKm: number } | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const moving = last.speedKmh > STOP_MAX_SPEED_KMH;

  // Start of the run of fixes in the same state as the last one
  let first = points.length - 1;
  while (first > 0 && points[first - 1].speedKmh > STOP_MAX_SPEED_KMH === moving) first--;

  if (!moving) return { moving, since: points[first].time, currentTripKm: 0 };

  // Moving: the trip started where the last real stop (3+ min) ended, so a traffic light
  // doesn't restart it
  const stops = detectStops(points.slice(0, points.length - 1));
  const lastStopEnd = stops.length ? stops[stops.length - 1].endTime : null;
  const tripStart = lastStopEnd ? Math.max(0, points.findIndex((p) => p.time >= lastStopEnd)) : 0;
  let km = 0;
  for (let i = tripStart + 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return { moving, since: points[tripStart].time, currentTripKm: Math.round(km * 100) / 100 };
}
