import { describe, expect, it } from "vitest";
import { lengthKm, locateOnLine, pathBetween } from "@/lib/route-path";

type LngLat = [number, number];
const cos = Math.cos((18.48 * Math.PI) / 180);
const km = 0.009; // ~1 km of latitude in degrees

describe("route-path", () => {
  // An L-shaped street: 1 km east, then 1 km north
  const street: LngLat[] = [
    [-69.93, 18.48],
    [-69.93 + (km / cos) * 0.5, 18.48],
    [-69.93 + km / cos, 18.48],
    [-69.93 + km / cos, 18.48 + km / 2],
    [-69.93 + km / cos, 18.48 + km],
  ];
  const fixes: LngLat[] = [
    [-69.93, 18.48],
    [-69.93 + (km / cos) * 0.6, 18.48],
    [-69.93 + km / cos, 18.48 + km * 0.4],
    [-69.93 + km / cos, 18.48 + km],
  ];
  const located = locateOnLine(street, fixes);

  it("locates each fix on its stretch of street", () => {
    expect(located.map((l) => l.segment)).toEqual([0, 1, 2, 3]);
  });

  it("goes around the corner instead of cutting it", () => {
    const path = pathBetween(street, located[1], located[2]);
    expect(path[1]).toEqual(street[2]);
    expect(lengthKm(path)).toBeGreaterThan(lengthKm([fixes[1], fixes[2]]) * 1.25);
  });

  it("measures the whole route along the street", () => {
    expect(lengthKm(pathBetween(street, located[0], located[3]))).toBeCloseTo(2, 1);
  });

  it("keeps time order on a street driven out and back", () => {
    const outAndBack: LngLat[] = [[-69.93, 18.48], [-69.92, 18.48], [-69.93, 18.48]];
    const l = locateOnLine(outAndBack, [[-69.928, 18.48], [-69.925, 18.48], [-69.925, 18.48], [-69.928, 18.48]]);
    expect(l.map((x) => x.segment)).toEqual([0, 0, 0, 1]);
  });

  it("doesn't reject a fix early on the next stretch", () => {
    const corner: LngLat[] = [[-69.93, 18.48], [-69.92, 18.48], [-69.92, 18.49]];
    const l = locateOnLine(corner, [[-69.9201, 18.48], [-69.92, 18.4802], [-69.92, 18.481]]);
    expect(l.map((x) => x.segment)).toEqual([0, 1, 1]);
  });
});
