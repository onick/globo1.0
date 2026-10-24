// History playback runs on the trip's own clock: at 1x, PLAYBACK_RATE seconds of the trip
// pass per real second, and the vehicle glides along the road between GPS reports instead
// of jumping from one to the next.

type LngLat = [number, number];

// Trip seconds per real second at 1x: a 30-minute trip plays in a minute
export const PLAYBACK_RATE = 30;

export interface TrackFix {
  time: number; // ms
  longitude: number;
  latitude: number;
  speed: number; // km/h
  course: number;
}

export interface TrackPoint {
  t: number; // ms
  lng: number;
  lat: number;
  speed: number;
  course: number;
}

function distanceM([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const x = ((lng2 - lng1) * Math.PI) / 180 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.hypot(x, y) * 6_371_000;
}

function bearing([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Timed points along the trip. paths[i] is the road from fix i to fix i+1 (both ends
// included); without it the vehicle goes straight. Between two fixes, time is spread by
// distance, so the vehicle keeps a steady pace along the road.
export function buildTrack(fixes: TrackFix[], paths: LngLat[][] | null): TrackPoint[] {
  if (fixes.length === 0) return [];
  const track: TrackPoint[] = [
    { t: fixes[0].time, lng: fixes[0].longitude, lat: fixes[0].latitude, speed: fixes[0].speed, course: fixes[0].course },
  ];
  for (let i = 0; i < fixes.length - 1; i++) {
    const from = fixes[i];
    const to = fixes[i + 1];
    const path: LngLat[] = paths?.[i]?.length
      ? paths[i]
      : [
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ];
    const legs = path.slice(1).map((p, j) => distanceM(path[j], p));
    const total = legs.reduce((a, b) => a + b, 0);
    let along = 0;
    path.slice(1).forEach((p, j) => {
      along += legs[j];
      const last = j === path.length - 2;
      const t = last ? to.time : from.time + (total > 0 ? (along / total) * (to.time - from.time) : 0);
      // Heading of the road while moving; the tracker's own once it stops
      const course = legs[j] > 1 ? bearing(path[j], p) : track[track.length - 1].course;
      track.push({ t, lng: p[0], lat: p[1], speed: last ? to.speed : from.speed, course: last && legs[j] <= 1 ? to.course : course });
    });
  }
  return track;
}

// Where the vehicle is at trip time t (clamped to the trip)
export function positionAt(track: TrackPoint[], t: number): TrackPoint | null {
  if (track.length === 0) return null;
  if (t <= track[0].t) return track[0];
  const end = track[track.length - 1];
  if (t >= end.t) return end;

  // Last point at or before t
  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = track[lo];
  const b = track[lo + 1];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  return {
    t,
    lng: a.lng + (b.lng - a.lng) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    speed: a.speed,
    course: b.course,
  };
}

// Trip time after `elapsedMs` of real time at a playback speed (1x, 2x, …)
export function advanceTime(t: number, elapsedMs: number, speed: number) {
  return t + elapsedMs * PLAYBACK_RATE * speed;
}

// The GPS report just before or after trip time t, for the step buttons
export function stepTo(fixTimes: number[], t: number, direction: -1 | 1): number {
  if (fixTimes.length === 0) return t;
  if (direction === 1) return fixTimes.find((f) => f > t) ?? fixTimes[fixTimes.length - 1];
  return [...fixTimes].reverse().find((f) => f < t) ?? fixTimes[0];
}
