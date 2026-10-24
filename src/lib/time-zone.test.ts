import { describe, expect, it } from "vitest";
import { dayBounds, dayKey, lastDays } from "@/lib/time-zone";

describe("time zone days", () => {
  it("knows it's still the previous day in Santo Domingo late at night UTC", () => {
    // 2026-10-25 02:00 UTC is 2026-10-24 22:00 in Santo Domingo (UTC-4)
    expect(dayKey(new Date("2026-10-25T02:00:00Z"), "America/Santo_Domingo")).toBe("2026-10-24");
  });

  it("starts the day at local midnight", () => {
    const { from, to } = dayBounds("2026-10-24", "America/Santo_Domingo");
    expect(from.toISOString()).toBe("2026-10-24T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-25T04:00:00.000Z");
  });

  it("handles a daylight saving change (New York, 2026-11-01 is 25 h long)", () => {
    const { from, to } = dayBounds("2026-11-01", "America/New_York");
    expect(from.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("lists the last days ending today, oldest first", () => {
    expect(lastDays(new Date("2026-10-25T02:00:00Z"), 3, "America/Santo_Domingo")).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
  });
});
