import type { RoutePoint } from "@/lib/history";

// A GPS fix `minutes` after 2026-10-24 10:00 UTC, on Santo Domingo's longitude
export function fix(
  minutes: number,
  latitude: number,
  speedKmh: number,
  ignition: boolean | null = null
): RoutePoint {
  return {
    latitude,
    longitude: -69.93,
    speedKmh,
    course: 0,
    time: new Date(Date.UTC(2026, 9, 24, 10, 0) + minutes * 60_000).toISOString(),
    snapped: null,
    ignition,
  };
}
