import { describe, expect, it } from "vitest";
import { currentState } from "@/lib/vehicle-state";
import { fix } from "@/test/fixtures";

describe("currentState", () => {
  it("has nothing to say without reports", () => {
    expect(currentState([])).toBeNull();
  });

  it("is stopped since it arrived", () => {
    const points = [fix(0, 18.48, 40), fix(2, 18.49, 30), fix(3, 18.5, 0), fix(10, 18.5, 0)];
    expect(currentState(points)).toEqual({ moving: false, since: points[2].time, currentTripKm: 0 });
  });

  it("is moving since it left its last stop, with the trip's distance", () => {
    // Parked 5 min, then drives north 0.01° per minute (~1.1 km)
    const points = [fix(0, 18.48, 0), fix(5, 18.48, 0), fix(6, 18.49, 40), fix(7, 18.5, 40)];
    const state = currentState(points)!;
    expect(state).toMatchObject({ moving: true, since: points[1].time });
    expect(state.currentTripKm).toBeCloseTo(2.22, 1);
  });

  it("doesn't restart the trip at a traffic light", () => {
    // Moving, 1 min at a light (not a 3-min stop), moving again
    const points = [fix(0, 18.48, 30), fix(1, 18.49, 30), fix(2, 18.49, 0), fix(3, 18.5, 30)];
    expect(currentState(points)).toMatchObject({ moving: true, since: points[0].time });
  });
});
