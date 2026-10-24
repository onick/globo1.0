import { describe, expect, it } from "vitest";
import { detectIdle, detectSpeeding, detectTrips } from "@/lib/activity";
import { detectStops } from "@/lib/history";
import { fix } from "@/test/fixtures";

// One fix per minute: parked 5 min with the engine on -> trip with a 1 min traffic light
// -> parked 10 min engine off -> fast trip -> parked
const day = [
  fix(0, 18.48, 0, true), fix(1, 18.48, 0, true), fix(2, 18.48, 0, true), fix(3, 18.48, 0, true), fix(4, 18.48, 0, true), fix(5, 18.48, 0, false),
  fix(6, 18.48, 30, true), fix(7, 18.485, 40, true), fix(8, 18.489, 0, true), fix(9, 18.49, 45, true), fix(10, 18.495, 50, true),
  fix(11, 18.5, 0, false), fix(15, 18.5, 0, false), fix(21, 18.5, 0, false),
  fix(22, 18.5, 90, true), fix(23, 18.508, 95, true), fix(24, 18.515, 60, true), fix(25, 18.52, 0, true), fix(29, 18.52, 0, false),
];

describe("detectTrips", () => {
  const trips = detectTrips(day, detectStops(day));

  it("finds the movement between stops; a traffic light stays inside the trip", () => {
    expect(trips).toHaveLength(2);
  });

  it("starts on the stop's last fix and ends on the next stop's first fix", () => {
    expect(trips[0]).toMatchObject({ startTime: day[5].time, endTime: day[11].time, durationMin: 6 });
    expect(trips[1]).toMatchObject({ startTime: day[13].time, endTime: day[17].time });
  });

  it("measures distance and speeds", () => {
    expect(trips[0].distanceKm).toBeCloseTo(2.22, 1);
    expect(trips[0]).toMatchObject({ maxSpeedKmh: 50, avgMovingSpeedKmh: 41.3, distanceSource: "gps" });
    expect(trips[1].maxSpeedKmh).toBe(95);
  });

  it("ignores GPS jitter around a parked vehicle", () => {
    const jitter = [fix(0, 18.5, 0), fix(4, 18.5, 0), fix(5, 18.5003, 5), fix(6, 18.5, 0), fix(10, 18.5, 0)];
    expect(detectTrips(jitter, detectStops(jitter))).toEqual([]);
  });
});

describe("detectIdle", () => {
  it("reports engine on and stopped for 2+ min, between observed fixes", () => {
    const idle = detectIdle(day);
    // The start only: the light (1 min) and engine-off stops don't count, and at the end a
    // single idling fix before engine-off could have idled anywhere from 0 to 4 min
    expect(idle).toHaveLength(1);
    expect(idle![0]).toMatchObject({ startTime: day[0].time, endTime: day[4].time, durationMin: 4 });
  });

  it("ends on the last idling fix", () => {
    const tail = detectIdle([fix(0, 18.5, 40, true), fix(1, 18.5, 0, true), fix(3, 18.5, 0, true), fix(5, 18.5, 0, false)]);
    expect(tail![0].durationMin).toBe(2);
  });

  it("is unavailable (null), not empty, without ignition data", () => {
    expect(detectIdle(day.map((p) => ({ ...p, ignition: null })))).toBeNull();
  });
});

describe("detectSpeeding", () => {
  it("groups consecutive fixes over the limit", () => {
    const events = detectSpeeding(day, 80);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fixes: 2, durationSec: 60, maxSpeedKmh: 95, latitude: 18.508 });
  });

  it("finds nothing under a higher limit", () => {
    expect(detectSpeeding(day, 100)).toEqual([]);
  });

  it("counts a single fix over the limit with duration 0", () => {
    expect(detectSpeeding([fix(0, 18.5, 85)], 80)[0].durationSec).toBe(0);
  });
});
