import { describe, expect, it } from "vitest";
import { combineDays, describeDay, EMPTY_DAY, percentChange, summarizeDay, topVehicles, type VehicleDay } from "@/lib/dashboard";

const vehicle = (id: string, distanceKm: number): VehicleDay => ({
  ...EMPTY_DAY,
  id,
  name: `Truck ${id}`,
  vehiclePlate: null,
  vehicleType: "truck",
  distanceKm,
});

describe("summarizeDay", () => {
  it("adds up the day's trips", () => {
    const day = summarizeDay(
      [
        { distanceKm: 5.72, durationMin: 5, maxSpeedKmh: 94.2 },
        { distanceKm: 3.45, durationMin: 5.3, maxSpeedKmh: 72.4 },
      ],
      3
    );
    expect(day).toEqual({ distanceKm: 9.17, drivingMin: 10.3, trips: 2, stops: 3, maxSpeedKmh: 94.2 });
  });

  it("is all zeros without trips", () => {
    expect(summarizeDay([], 1)).toEqual({ ...EMPTY_DAY, stops: 1 });
  });
});

describe("combineDays", () => {
  it("sums the fleet and keeps the highest speed", () => {
    const fleet = combineDays([
      { distanceKm: 9.17, drivingMin: 10.3, trips: 2, stops: 3, maxSpeedKmh: 94.2 },
      { distanceKm: 12.82, drivingMin: 23, trips: 2, stops: 1, maxSpeedKmh: 55.5 },
      EMPTY_DAY,
    ]);
    expect(fleet).toEqual({ distanceKm: 21.99, drivingMin: 33.3, trips: 4, stops: 4, maxSpeedKmh: 94.2 });
  });
});

describe("topVehicles", () => {
  it("ranks by distance and leaves out vehicles that didn't move", () => {
    const top = topVehicles([vehicle("a", 3), vehicle("b", 0), vehicle("c", 12), vehicle("d", 7)], 2);
    expect(top.map((v) => v.id)).toEqual(["c", "d"]);
  });
});

describe("percentChange", () => {
  it("compares with the previous value", () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("has nothing to compare against zero", () => {
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("describeDay", () => {
  const today = { distanceKm: 21.99, drivingMin: 33.3, trips: 4, stops: 4, maxSpeedKmh: 94.2 };

  it("summarizes the fleet's day", () => {
    expect(describeDay({ movedVehicles: 2, totalVehicles: 4, today, speedingAlerts: 1 })).toBe(
      "2 of 4 vehicles moved today, covering 22 km in 0.6 h. 1 speeding alert."
    );
  });

  it("says when nothing moved, or there are no vehicles", () => {
    expect(describeDay({ movedVehicles: 0, totalVehicles: 4, today: EMPTY_DAY, speedingAlerts: 0 })).toBe(
      "None of your 4 vehicles has moved today."
    );
    expect(describeDay({ movedVehicles: 0, totalVehicles: 0, today: EMPTY_DAY, speedingAlerts: 0 })).toMatch(/No vehicles yet/);
  });
});
