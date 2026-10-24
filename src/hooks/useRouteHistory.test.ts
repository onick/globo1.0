import { describe, expect, it } from "vitest";
import { shapeHistory } from "@/hooks/useRouteHistory";
import { detectStops, summarizeRoute, type RoutePoint } from "@/lib/history";
import { fix } from "@/test/fixtures";

// Drive north 2 min, park 5 min, drive north 2 min (one fix per minute)
const points: RoutePoint[] = [
  fix(0, 18.48, 30), fix(1, 18.485, 40), fix(2, 18.49, 0),
  fix(4, 18.49, 0), fix(7, 18.49, 0), fix(8, 18.495, 45), fix(9, 18.5, 50),
];
const stops = detectStops(points).map((s) => ({ ...s, address: null }));

describe("shapeHistory", () => {
  const shaped = shapeHistory({ points, stops, route: null, summary: summarizeRoute(points) });

  it("splits the day into moving and stopped stretches around each stop", () => {
    expect(shaped.segments.map((s) => s.type)).toEqual(["moving", "stopped", "moving"]);
    expect(shaped.segments[1]).toMatchObject({ startTime: points[2].time, endTime: points[4].time, distance: 0 });
  });

  it("keeps the speeds in km/h", () => {
    expect(shaped.segments[0].maxSpeed).toBe(40);
    expect(shaped.segments[2].maxSpeed).toBe(50);
    expect(shaped.summary.maxSpeed).toBe(50);
  });

  it("adds up the moving distance and summarizes stops", () => {
    const moving = shaped.segments.filter((s) => s.type === "moving").reduce((a, s) => a + s.distance, 0);
    expect(moving).toBeCloseTo(shaped.summary.totalDistance, 1);
    expect(shaped.summary).toMatchObject({ stopCount: 1, stoppedDuration: 5 * 60_000 });
    expect(shaped.stops[0].duration).toBe(5 * 60_000);
  });

  it("draws along the matched road when there is one", () => {
    // The matched road jogs east between the first two fixes
    const road: [number, number][] = [[-69.93, 18.48], [-69.925, 18.4825], [-69.93, 18.485], [-69.93, 18.5]];
    const snapped = points.map((p) => ({ ...p, snapped: [p.longitude, p.latitude] as [number, number] }));
    const matched = shapeHistory({
      points: snapped,
      stops,
      route: { snappedToRoads: true, segments: [road] },
      summary: summarizeRoute(snapped, 3),
    });
    expect(matched.baseLine).toEqual(road);
    const firstStretch = matched.segments[0].positions.map((p) => [p.longitude, p.latitude]);
    expect(firstStretch).toContainEqual(road[1]);
    expect(matched.segments[0].distance).toBeGreaterThan(shaped.segments[0].distance);
    expect(matched.summary.totalDistance).toBe(3);
  });
});
