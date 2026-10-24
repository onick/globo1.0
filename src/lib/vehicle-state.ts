import { detectStops, haversineKm, MAX_REPORT_GAP_MIN, STOP_MAX_SPEED_KMH, type RoutePoint } from "@/lib/history";

// What a vehicle is doing according to its last report, and since when: moving since it
// left its last stop, stopped since it arrived. Also the distance of the trip in progress
// (0 while stopped). Points are the vehicle's recent fixes in time order.
// The trip starts where its last stop ended, or after its last gap without reports.
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
  let tripStart = lastStopEnd ? Math.max(0, points.findIndex((p) => p.time >= lastStopEnd)) : 0;
  // …or where it reappeared after a gap without reports
  for (let i = points.length - 1; i > tripStart; i--) {
    if (new Date(points[i].time).getTime() - new Date(points[i - 1].time).getTime() > MAX_REPORT_GAP_MIN * 60_000) {
      tripStart = i;
      break;
    }
  }
  let km = 0;
  for (let i = tripStart + 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return { moving, since: points[tripStart].time, currentTripKm: Math.round(km * 100) / 100 };
}
