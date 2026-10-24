// Route history helpers: pure functions shared by the history API and its tests.

export interface RoutePoint {
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number;
  time: string;
}

export interface RouteStop {
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  durationMin: number;
  address: string | null;
}

export interface RouteSummary {
  points: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgMovingSpeedKmh: number;
  durationMin: number;
}

// Longest range a single history request may cover.
export const MAX_RANGE_DAYS = 7;

// Traccar reports speed in knots.
export function knotsToKmh(knots: number): number {
  return knots * 1.852;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function summarizeRoute(points: RoutePoint[]): RouteSummary {
  let distanceKm = 0;
  let maxSpeedKmh = 0;
  let movingSpeedSum = 0;
  let movingCount = 0;

  points.forEach((point, i) => {
    if (i > 0) distanceKm += haversineKm(points[i - 1], point);
    maxSpeedKmh = Math.max(maxSpeedKmh, point.speedKmh);
    if (point.speedKmh > 1) {
      movingSpeedSum += point.speedKmh;
      movingCount++;
    }
  });

  const durationMin =
    points.length > 1
      ? (new Date(points[points.length - 1].time).getTime() - new Date(points[0].time).getTime()) /
        60000
      : 0;

  return {
    points: points.length,
    distanceKm: round(distanceKm, 2),
    maxSpeedKmh: round(maxSpeedKmh, 1),
    avgMovingSpeedKmh: movingCount ? round(movingSpeedSum / movingCount, 1) : 0,
    durationMin: Math.round(durationMin),
  };
}

// Validates the from/to query params. Returns an error message or the parsed dates.
export function parseRange(
  from: string | null,
  to: string | null
): { error: string } | { from: Date; to: Date } {
  if (!from || !to) return { error: "from and to are required" };
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { error: "from and to must be valid dates" };
  }
  if (toDate <= fromDate) return { error: "to must be after from" };
  if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_DAYS * 24 * 3600 * 1000) {
    return { error: `Range cannot exceed ${MAX_RANGE_DAYS} days` };
  }
  return { from: fromDate, to: toDate };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
