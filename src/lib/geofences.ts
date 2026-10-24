// Geofence limits and geometry shared by the API and the map

export const MIN_RADIUS_M = 30;
export const MAX_RADIUS_M = 50_000;

// Polygon approximating a circle, for drawing it on the map ([lon, lat] ring, closed)
export function circlePolygon(
  latitude: number,
  longitude: number,
  radiusM: number,
  steps = 64
): [number, number][] {
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos((latitude * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      longitude + (radiusM * Math.cos(angle)) / metersPerDegLon,
      latitude + (radiusM * Math.sin(angle)) / metersPerDegLat,
    ]);
  }
  return ring;
}

/* ── Polygons ─────────────────────────────────────────── */

export type LngLat = [number, number];

export const MIN_POLYGON_POINTS = 3;
export const MAX_POLYGON_POINTS = 100;
// Smallest and largest area worth watching (a parking spot … a province)
export const MIN_POLYGON_AREA_M2 = 100;
export const MAX_POLYGON_SPAN_M = 100_000;

// Local flat projection in meters around a reference latitude: accurate enough at the
// size of a geofence
function toMeters([lng, lat]: LngLat, refLat: number): [number, number] {
  return [lng * 111_320 * Math.cos((refLat * Math.PI) / 180), lat * 110_574];
}

// Ray casting: whether the point is inside the ring (first point not repeated at the end)
export function pointInPolygon([lng, lat]: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Distance in meters from the point to the nearest edge of the ring
export function distanceToRingM(point: LngLat, ring: LngLat[]): number {
  const [px, py] = toMeters(point, point[1]);
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = toMeters(ring[i], point[1]);
    const [bx, by] = toMeters(ring[(i + 1) % ring.length], point[1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

export function polygonAreaM2(ring: LngLat[]): number {
  const refLat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const pts = ring.map((p) => toMeters(p, refLat));
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

// Center of the ring's points and the radius of a circle around it that holds the whole
// polygon: what the geofence list and the map labels use
export function polygonCenter(ring: LngLat[]): { latitude: number; longitude: number; radiusM: number } {
  const longitude = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const latitude = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const [cx, cy] = toMeters([longitude, latitude], latitude);
  const radiusM = Math.max(
    ...ring.map((p) => {
      const [x, y] = toMeters(p, latitude);
      return Math.hypot(x - cx, y - cy);
    })
  );
  return { latitude, longitude, radiusM: Math.ceil(radiusM) };
}

function segmentsCross(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const cross = (o: LngLat, p: LngLat, q: LngLat) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// A drawn polygon, checked: 3–100 points with valid coordinates, edges that don't cross
// and a sensible size. The closing point, if sent, is dropped.
export function validatePolygon(value: unknown): { ring: LngLat[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "The polygon must be a list of points" };
  const ring = value.filter(
    (p): p is LngLat =>
      Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n))
  );
  if (ring.length !== value.length) return { error: "Each point must be [longitude, latitude]" };
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  if (ring.some(([lng, lat]) => lng < -180 || lng > 180 || lat < -90 || lat > 90)) return { error: "Invalid coordinates" };
  if (ring.length < MIN_POLYGON_POINTS || ring.length > MAX_POLYGON_POINTS) {
    return { error: `A polygon needs ${MIN_POLYGON_POINTS} to ${MAX_POLYGON_POINTS} points` };
  }
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      // Adjacent edges share a point; they can't cross
      if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
      if (segmentsCross(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) {
        return { error: "The polygon's edges cross each other" };
      }
    }
  }
  if (polygonAreaM2(ring) < MIN_POLYGON_AREA_M2) return { error: "The polygon is too small" };
  if (polygonCenter(ring).radiusM * 2 > MAX_POLYGON_SPAN_M) return { error: "The polygon is too large (100 km at most)" };
  return { ring };
}
