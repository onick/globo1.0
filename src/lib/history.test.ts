import { describe, expect, it } from "vitest";
import { detectStops, haversineKm, knotsToKmh, parseRange, summarizeRoute } from "@/lib/history";
import { chunkRanges, movingIndexes } from "@/lib/map-matching";
import { fix } from "@/test/fixtures";

describe("units and distance", () => {
  it("converts Traccar's knots to km/h", () => {
    expect(knotsToKmh(10)).toBeCloseTo(18.52, 2);
  });

  it("measures straight-line distance", () => {
    // Santo Domingo -> Santiago, ~130 km in a straight line
    const km = haversineKm({ latitude: 18.4861, longitude: -69.9312 }, { latitude: 19.4517, longitude: -70.697 });
    expect(km).toBeGreaterThan(125);
    expect(km).toBeLessThan(135);
  });
});

describe("summarizeRoute", () => {
  const route = [fix(0, 18.48, 0), fix(2, 18.49, 40), fix(4, 18.5, 60)];

  it("uses the GPS distance when the route wasn't matched", () => {
    const s = summarizeRoute(route);
    expect(s.distanceSource).toBe("gps");
    expect(s.distanceKm).toBeCloseTo(2.22, 1);
    expect(s.gpsDistanceKm).toBe(s.distanceKm);
  });

  it("uses the road distance when given, keeping the GPS one for comparison", () => {
    const s = summarizeRoute(route, 3.456);
    expect(s.distanceSource).toBe("roads");
    expect(s.distanceKm).toBe(3.46);
    expect(s.gpsDistanceKm).toBeCloseTo(2.22, 1);
    expect(s).toMatchObject({ maxSpeedKmh: 60, avgMovingSpeedKmh: 50, durationMin: 4 });
  });
});

describe("detectStops", () => {
  it("reports stops of 3+ min from their first to their last stopped fix", () => {
    const trip = [fix(0, 18.48, 0), fix(1, 18.481, 30), fix(2, 18.482, 2), fix(4, 18.482, 0), fix(8, 18.482, 1), fix(9, 18.483, 35), fix(10, 18.484, 0)];
    const stops = detectStops(trip);
    expect(stops).toHaveLength(1); // the 0-min "stop" at the start is ignored
    expect(stops[0]).toMatchObject({ startTime: trip[2].time, endTime: trip[4].time, durationMin: 6, latitude: 18.482 });
  });

  it("reports a stop still going at the end of the range", () => {
    expect(detectStops([fix(0, 18.48, 40), fix(1, 18.49, 0), fix(5, 18.49, 0)])).toHaveLength(1);
  });

  it("handles no positions", () => {
    expect(detectStops([])).toEqual([]);
  });
});

describe("map matching requests", () => {
  it("splits fixes into windows that share their edge point", () => {
    expect(chunkRanges(1, 100)).toEqual([]);
    expect(chunkRanges(50, 100)).toEqual([[0, 50]]);
    expect(chunkRanges(100, 100)).toEqual([[0, 100]]);
    expect(chunkRanges(101, 100)).toEqual([[0, 100], [99, 101]]);
    expect(chunkRanges(250, 100)).toEqual([[0, 100], [99, 199], [198, 250]]);
  });

  it("doesn't send parked fixes (GPS jitter under 15 m)", () => {
    const parked = [fix(0, 18.48, 0), fix(1, 18.48004, 0), fix(2, 18.47997, 0), fix(3, 18.481, 20)];
    expect(movingIndexes(parked)).toEqual([0, 3]);
  });
});

describe("parseRange", () => {
  it.each([
    [null, "2026-10-24T00:00:00Z"],
    ["not a date", "2026-10-24T00:00:00Z"],
    ["2026-10-24T10:00:00Z", "2026-10-24T09:00:00Z"],
    ["2026-10-01T00:00:00Z", "2026-10-24T00:00:00Z"],
  ])("rejects from=%s to=%s", (from, to) => {
    expect(parseRange(from, to)).toHaveProperty("error");
  });

  it("accepts up to 7 days", () => {
    expect(parseRange("2026-10-17T00:00:00Z", "2026-10-24T00:00:00Z")).not.toHaveProperty("error");
  });
});
