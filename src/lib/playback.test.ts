import { describe, expect, it } from "vitest";
import { advanceTime, buildTrack, PLAYBACK_RATE, positionAt, stepTo, type TrackFix } from "@/lib/playback";

const T0 = Date.UTC(2026, 9, 24, 10, 0);
const fix = (minutes: number, lng: number, lat: number, speed = 30, course = 0): TrackFix => ({
  time: T0 + minutes * 60_000,
  longitude: lng,
  latitude: lat,
  speed,
  course,
});

describe("buildTrack", () => {
  it("goes straight between fixes without a road", () => {
    const track = buildTrack([fix(0, -69.9, 18.48), fix(1, -69.9, 18.49)], null);
    expect(track.map((p) => [p.t, p.lat])).toEqual([
      [T0, 18.48],
      [T0 + 60_000, 18.49],
    ]);
  });

  it("follows the road and spreads the time by distance", () => {
    // East 2 units then north 1: the corner is reached at 2/3 of the time
    const road: [number, number][] = [
      [-69.9, 18.48],
      [-69.898, 18.48],
      [-69.898, 18.481],
    ];
    const track = buildTrack([fix(0, -69.9, 18.48), fix(3, -69.898, 18.481)], [road]);
    expect(track).toHaveLength(3);
    expect(track[1].lng).toBe(-69.898);
    expect((track[1].t - T0) / 60_000).toBeCloseTo(2, 1);
    expect(track[2].t).toBe(T0 + 3 * 60_000);
    // Heading east, then north
    expect(track[1].course).toBeCloseTo(90, 0);
    expect(track[2].course).toBeCloseTo(0, 0);
  });

  it("keeps the vehicle still while it's stopped", () => {
    const track = buildTrack([fix(0, -69.9, 18.48, 0, 45), fix(5, -69.9, 18.48, 0, 45)], null);
    expect(positionAt(track, T0 + 2 * 60_000)).toMatchObject({ lng: -69.9, lat: 18.48, course: 45 });
  });
});

describe("positionAt", () => {
  const track = buildTrack([fix(0, -69.9, 18.48), fix(2, -69.9, 18.5)], null);

  it("interpolates between points", () => {
    expect(positionAt(track, T0 + 60_000)!.lat).toBeCloseTo(18.49, 6);
  });

  it("stays at the ends outside the trip", () => {
    expect(positionAt(track, T0 - 1)!.lat).toBe(18.48);
    expect(positionAt(track, T0 + 10 * 60_000)!.lat).toBe(18.5);
    expect(positionAt([], T0)).toBeNull();
  });
});

describe("playback clock", () => {
  it("runs PLAYBACK_RATE trip seconds per real second at 1x, and faster at higher speeds", () => {
    expect(advanceTime(T0, 1000, 1)).toBe(T0 + PLAYBACK_RATE * 1000);
    expect(advanceTime(T0, 1000, 8)).toBe(T0 + 8 * PLAYBACK_RATE * 1000);
  });

  it("steps to the previous and next GPS report", () => {
    const times = [T0, T0 + 30_000, T0 + 60_000];
    expect(stepTo(times, T0 + 10_000, 1)).toBe(T0 + 30_000);
    expect(stepTo(times, T0 + 30_000, 1)).toBe(T0 + 60_000);
    expect(stepTo(times, T0 + 40_000, -1)).toBe(T0 + 30_000);
    expect(stepTo(times, T0, -1)).toBe(T0);
    expect(stepTo(times, T0 + 60_000, 1)).toBe(T0 + 60_000);
  });
});
