import { describe, expect, it } from "vitest";
import {
  distanceToRingM,
  pointInPolygon,
  polygonAreaM2,
  parseGeofenceShape,
  polygonCenter,
  validatePolygon,
  type LngLat,
} from "@/lib/geofences";

// About 220 m × 220 m around a point in Santo Domingo
const SQUARE: LngLat[] = [
  [-69.931, 18.48],
  [-69.929, 18.48],
  [-69.929, 18.482],
  [-69.931, 18.482],
];

describe("polygon geometry", () => {
  it("knows inside from outside", () => {
    expect(pointInPolygon([-69.93, 18.481], SQUARE)).toBe(true);
    expect(pointInPolygon([-69.927, 18.481], SQUARE)).toBe(false);
  });

  it("handles concave shapes (an L)", () => {
    const L: LngLat[] = [
      [0, 0],
      [0.002, 0],
      [0.002, 0.001],
      [0.001, 0.001],
      [0.001, 0.002],
      [0, 0.002],
    ];
    expect(pointInPolygon([0.0005, 0.0015], L)).toBe(true);
    expect(pointInPolygon([0.0015, 0.0015], L)).toBe(false); // the missing corner
  });

  it("measures the distance to the nearest edge", () => {
    // 0.001° of longitude east of the edge at 18.48° N ≈ 105.9 m
    expect(distanceToRingM([-69.928, 18.481], SQUARE)).toBeCloseTo(105.9, 0);
    // From the middle, the nearest edge is half the side away
    expect(distanceToRingM([-69.93, 18.481], SQUARE)).toBeCloseTo(105.9, 0);
  });

  it("measures the area and the circle around it", () => {
    expect(polygonAreaM2(SQUARE)).toBeCloseTo(211.2 * 221.1, -2);
    expect(polygonCenter(SQUARE)).toMatchObject({ latitude: 18.481, longitude: -69.93 });
    expect(polygonCenter(SQUARE).radiusM).toBeGreaterThan(150);
  });
});

describe("validatePolygon", () => {
  it("accepts a drawn polygon and drops the closing point", () => {
    expect(validatePolygon([...SQUARE, SQUARE[0]])).toEqual({ ring: SQUARE });
  });

  it.each([
    ["not a list", "x", /list/],
    ["two points", SQUARE.slice(0, 2), /3 to 100/],
    ["bad point", [...SQUARE.slice(0, 3), [1]], /longitude, latitude/],
    ["out of range", [[200, 0], [0, 1], [1, 1]], /Invalid/],
    [
      "crossing edges (a bow tie)",
      [
        [-69.931, 18.48],
        [-69.929, 18.482],
        [-69.929, 18.48],
        [-69.931, 18.482],
      ],
      /cross/,
    ],
    ["tiny", [[0, 0], [0.00001, 0], [0, 0.00001]], /small/],
    ["huge", [[-71, 18], [-68, 18], [-68, 19.5]], /large/],
  ])("rejects %s", (_name, value, message) => {
    const result = validatePolygon(value);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(message);
  });
});

describe("parseGeofenceShape", () => {
  it("reads a circle", () => {
    expect(parseGeofenceShape({ latitude: 18.48, longitude: -69.93, radiusM: 200 })).toEqual({
      data: { shape: "circle", latitude: 18.48, longitude: -69.93, radiusM: 200, polygon: null },
    });
  });

  it("reads a drawn polygon with its center", () => {
    const result = parseGeofenceShape({ shape: "polygon", polygon: SQUARE });
    expect(result).toMatchObject({ data: { shape: "polygon", polygon: SQUARE, latitude: 18.481, longitude: -69.93 } });
  });

  it.each([
    [{ latitude: 95, longitude: 0, radiusM: 200 }, /coordinates/],
    [{ latitude: 18, longitude: -69, radiusM: 10 }, /Radius/],
    [{ latitude: 18, longitude: -69, radiusM: 200.5 }, /Radius/],
    [{ shape: "polygon", polygon: SQUARE.slice(0, 2) }, /3 to 100/],
  ])("rejects %o", (body, message) => {
    const result = parseGeofenceShape(body);
    expect((result as { error: string }).error).toMatch(message);
  });
});
