// Snap a GPS trace to the road network with OSRM's match service, so the route follows
// the streets instead of straight lines between fixes.
// OSRM_URL must point at an OSRM server with road data for the area (self-hosted in
// production; the public demo server is only for light testing).

import type { RoutePoint } from "@/lib/history";

type LngLat = [number, number];

export interface MatchedRoute {
  // One line per continuous matched stretch; GPS gaps split the route
  segments: LngLat[][];
  distanceKm: number;
  // Position on the road for each input point, or null when OSRM dropped it
  snapped: (LngLat | null)[];
}

interface OsrmMatchResponse {
  code: string;
  matchings?: { distance: number; geometry: { coordinates: LngLat[] } }[];
  tracepoints?: ({ location: LngLat; matchings_index: number } | null)[];
}

// osrm-routed accepts at most 100 coordinates per match request by default
// (--max-matching-size); the public demo server accepts far fewer.
export const MAX_POINTS_PER_REQUEST = 100;
// Search radius around each fix, in meters. Tested against a simulated trace with known
// streets: 15 m left the least route unmatched (25 m drifted onto parallel roads, no
// radius cut 14% of the route off-street) while tolerating urban GPS error.
const GPS_RADIUS_M = 15;
const REQUEST_TIMEOUT_MS = 10000;

// Driving between two fixes follows the streets, so the road distance is longer than the
// straight lines between fixes, but not by much: in tests on real streets it was 3-9% longer.
// A match far longer than that means the fixes don't lie on roads (bad GPS, or a trace
// OSRM had to route around), and the road distance would inflate the kilometers customers
// see, so the GPS distance is kept instead.
export const MAX_ROAD_TO_GPS_RATIO = 1.6;
const PLAUSIBILITY_SLACK_KM = 0.5;

export function isPlausibleMatch(gpsKm: number, roadKm: number): boolean {
  return roadKm <= gpsKm * MAX_ROAD_TO_GPS_RATIO + PLAUSIBILITY_SLACK_KM;
}

// Splits [0, length) into windows of at most `size`, each starting where the previous
// one ended, so consecutive requests share a point and no stretch is left unmatched.
export function chunkRanges(length: number, size: number): [number, number][] {
  if (length < 2) return [];
  const ranges: [number, number][] = [];
  for (let start = 0; start < length - 1; start += size - 1) {
    ranges.push([start, Math.min(start + size, length)]);
  }
  return ranges;
}

// Drops consecutive fixes at (almost) the same place, e.g. a parked vehicle: OSRM matches
// them poorly and they add nothing to the route. Returns the indexes that are kept.
export function movingIndexes(points: RoutePoint[], minGapM = 15): number[] {
  const kept: number[] = [];
  points.forEach((p, i) => {
    const prev = kept.length ? points[kept[kept.length - 1]] : null;
    if (!prev || distanceBetweenM(prev, p) >= minGapM) kept.push(i);
  });
  return kept;
}

export async function matchRoute(
  points: RoutePoint[],
  osrmUrl: string,
  maxPointsPerRequest = MAX_POINTS_PER_REQUEST
): Promise<MatchedRoute | null> {
  const indexes = movingIndexes(points);
  if (indexes.length < 2) return null;

  const snapped: (LngLat | null)[] = points.map(() => null);
  const segments: LngLat[][] = [];
  let distanceM = 0;

  for (const [from, to] of chunkRanges(indexes.length, maxPointsPerRequest)) {
    const chunk = indexes.slice(from, to).map((i) => points[i]);
    const result = await requestMatch(chunk, osrmUrl);

    if (!result.matchings?.length) {
      // Unmatchable stretch (no roads nearby, bad fixes): keep the GPS line so the
      // route has no holes
      segments.push(chunk.map((p) => [p.longitude, p.latitude]));
      chunk.forEach((p, j) => {
        if (j > 0) distanceM += distanceBetweenM(chunk[j - 1], p);
      });
      continue;
    }

    result.matchings.forEach((m) => {
      distanceM += m.distance;
      segments.push(m.geometry.coordinates);
    });
    result.tracepoints?.forEach((tp, j) => {
      if (tp) snapped[indexes[from + j]] = tp.location;
    });
  }

  if (!segments.length) return null;

  const gpsKm = indexes.reduce((sum, idx, k) => (k ? sum + distanceBetweenM(points[indexes[k - 1]], points[idx]) : 0), 0) / 1000;
  if (!isPlausibleMatch(gpsKm, distanceM / 1000)) {
    console.warn(
      `Map matching discarded: ${(distanceM / 1000).toFixed(2)} km by road vs ${gpsKm.toFixed(2)} km between fixes`
    );
    return null;
  }

  // Parked fixes take the snapped position of the last moving fix before them
  const sent = new Set(indexes);
  let last: LngLat | null = null;
  points.forEach((_, i) => {
    if (snapped[i]) last = snapped[i];
    else if (!sent.has(i)) snapped[i] = last;
  });

  return { segments, distanceKm: distanceM / 1000, snapped };
}

async function requestMatch(chunk: RoutePoint[], osrmUrl: string): Promise<OsrmMatchResponse> {
  const coords = chunk.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(";");
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    gaps: "split",
    tidy: "true",
    timestamps: chunk.map((p) => Math.floor(new Date(p.time).getTime() / 1000)).join(";"),
    radiuses: chunk.map(() => GPS_RADIUS_M).join(";"),
  });

  const response = await fetch(
    `${osrmUrl.replace(/\/$/, "")}/match/v1/driving/${coords}?${params}`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  );
  const body = (await response.json()) as OsrmMatchResponse;
  // NoMatch / NoSegment: this stretch could not be matched; the caller keeps the GPS line
  if (!response.ok && body.code !== "NoMatch" && body.code !== "NoSegment") {
    throw new Error(`OSRM match failed: ${response.status} ${body.code}`);
  }
  return body;
}

function distanceBetweenM(a: RoutePoint, b: RoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x = toRad(b.longitude - a.longitude) * Math.cos(toRad((a.latitude + b.latitude) / 2));
  const y = toRad(b.latitude - a.latitude);
  return Math.sqrt(x * x + y * y) * 6371000;
}
