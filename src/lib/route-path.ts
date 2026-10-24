// Locates GPS fixes on the road-matched route so any stretch between two fixes can be
// drawn along the streets (instead of a straight line) and measured along them.

type LngLat = [number, number];

export interface PathLocation {
  // Segment of the line the fix falls on (between vertex `segment` and `segment + 1`)
  segment: number;
  point: LngLat;
}

const METERS_PER_DEG_LAT = 111_320;

function toMeters(p: LngLat, cosLat: number): [number, number] {
  return [p[0] * METERS_PER_DEG_LAT * cosLat, p[1] * METERS_PER_DEG_LAT];
}

function project(
  p: LngLat,
  a: LngLat,
  b: LngLat,
  cosLat: number
): { point: LngLat; distM: number; alongM: number } {
  const [px, py] = toMeters(p, cosLat);
  const [ax, ay] = toMeters(a, cosLat);
  const [bx, by] = toMeters(b, cosLat);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    distM: Math.hypot(px - ax - t * dx, py - ay - t * dy),
    alongM: t * Math.sqrt(len2),
  };
}

// A fix may land this far behind the previous one on the same segment (GPS jitter)
const BACKTRACK_TOLERANCE_M = 15;
// Prefer the earlier segment unless a later one is clearly closer
const TIE_M = 1;

export function lengthKm(path: LngLat[]): number {
  if (path.length < 2) return 0;
  const cosLat = Math.cos((path[0][1] * Math.PI) / 180);
  let m = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = toMeters(path[i - 1], cosLat);
    const [bx, by] = toMeters(path[i], cosLat);
    m += Math.hypot(bx - ax, by - ay);
  }
  return m / 1000;
}

// Fixes are in time order and the route only goes forward, so each fix is searched from
// where the previous one landed and never behind it. On a street driven out and back the
// geometry alone can't tell the two ways apart; the order can.
export function locateOnLine(line: LngLat[], fixes: LngLat[]): PathLocation[] {
  if (line.length < 2) return fixes.map((p) => ({ segment: 0, point: p }));
  const cosLat = Math.cos((line[0][1] * Math.PI) / 180);
  const locations: PathLocation[] = [];
  let from = 0;
  let fromAlongM = 0;

  for (const fix of fixes) {
    let best = { segment: from, point: line[from] as LngLat, distM: Infinity, alongM: fromAlongM };
    for (let s = from; s < line.length - 1; s++) {
      const candidate = project(fix, line[s], line[s + 1], cosLat);
      if (s === from && candidate.alongM < fromAlongM - BACKTRACK_TOLERANCE_M) continue;
      if (candidate.distM < best.distM - TIE_M) best = { segment: s, ...candidate };
      // Once well past a close match, stop scanning ahead
      if (best.distM < 5 && s > best.segment + 50) break;
    }
    locations.push({ segment: best.segment, point: best.point });
    fromAlongM = best.segment === from ? Math.max(best.alongM, fromAlongM) : best.alongM;
    from = best.segment;
  }
  return locations;
}

// Along-the-road path from one located fix to a later one
export function pathBetween(line: LngLat[], from: PathLocation, to: PathLocation): LngLat[] {
  if (to.segment < from.segment) return [from.point, to.point];
  return [from.point, ...line.slice(from.segment + 1, to.segment + 1), to.point];
}
