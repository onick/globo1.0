import { describe, expect, it } from "vitest";
import { evaluatePosition, type DeviceAlertState, type EngineGeofence } from "@/lib/alert-engine";

const DEPOT: EngineGeofence = { id: "depot", latitude: 18.48, longitude: -69.93, radiusM: 100 };
// Longitude `m` meters east of the depot's center, on the same latitude
const lonAt = (m: number) => -69.93 + m / (111_320 * Math.cos((18.48 * Math.PI) / 180));

// Fix times keep increasing across drive() calls, so a run can continue from an earlier
// state (the engine skips fixes older than the last one it saw)
let clock = 0;

// Feeds positions 10 s apart ([meters east, km/h]) and returns the alerts raised
function drive(
  steps: [number, number?][],
  geofences = [DEPOT],
  limit = 80,
  start: DeviceAlertState | null = null
) {
  let state = start;
  const alerts: string[] = [];
  steps.forEach(([m, kmh = 30]) => {
    const time = new Date(Date.UTC(2026, 9, 24, 12, 0, clock++ * 10)).toISOString();
    const r = evaluatePosition(state, { time, latitude: 18.48, longitude: lonAt(m), speedKmh: kmh }, geofences, limit);
    state = r.state;
    alerts.push(...r.alerts.map((a) => a.type + (a.geofenceId ? `:${a.geofenceId}` : "")));
  });
  return { state, alerts };
}

describe("geofences", () => {
  it("raises nothing for the first position, even inside (it didn't cross in)", () => {
    expect(drive([[0]]).alerts).toEqual([]);
  });

  it("raises enter and exit", () => {
    expect(drive([[300], [150], [50], [0], [-50], [-200]]).alerts).toEqual(["geofence_enter:depot", "geofence_exit:depot"]);
  });

  it("doesn't flap on GPS jitter at the edge (exit only beyond radius + 25 m)", () => {
    expect(drive([[300], [95], [110], [98], [120], [104], [130]]).alerts).toEqual(["geofence_enter:depot", "geofence_exit:depot"]);
  });

  it("handles overlapping geofences", () => {
    const client: EngineGeofence = { id: "client", latitude: 18.48, longitude: lonAt(150), radiusM: 100 };
    expect(drive([[-300], [0], [100], [250], [400]], [DEPOT, client]).alerts).toEqual([
      "geofence_enter:depot",
      "geofence_enter:client",
      "geofence_exit:depot",
      "geofence_exit:client",
    ]);
  });

  it("gives no enter for a geofence created around the vehicle, but an exit when it leaves", () => {
    const { state } = drive([[0]], []);
    expect(drive([[10], [300]], [DEPOT], 80, state).alerts).toEqual(["geofence_exit:depot"]);
  });

  it("drops a deleted geofence without an exit", () => {
    const { state } = drive([[300], [0]]);
    const after = drive([[400]], [], 80, state);
    expect(after.alerts).toEqual([]);
    expect(after.state?.inside).toEqual([]);
  });
});

describe("overspeed", () => {
  it("raises one alert per episode; it resets 5 km/h below the limit", () => {
    expect(drive([[0, 60], [0, 85], [0, 90], [0, 78], [0, 84], [0, 70], [0, 88]]).alerts).toEqual(["overspeed", "overspeed"]);
  });

  it("raises nothing when the first fix is already over the limit", () => {
    expect(drive([[0, 95], [0, 96]]).alerts).toEqual([]);
  });
});

describe("fix order", () => {
  const first = evaluatePosition(null, { time: "2026-10-24T12:00:20Z", latitude: 18.48, longitude: lonAt(300), speedKmh: 30 }, [DEPOT], 80);

  it("skips older fixes without changing the state", () => {
    const older = evaluatePosition(first.state, { time: "2026-10-24T12:00:10Z", latitude: 18.48, longitude: lonAt(0), speedKmh: 30 }, [DEPOT], 80);
    expect(older.skipped).toBe(true);
    expect(older.alerts).toEqual([]);
    expect(older.state).toBe(first.state);
  });

  it("skips a repeated fix written in another format", () => {
    const same = evaluatePosition(first.state, { time: "2026-10-24T12:00:20.000+00:00", latitude: 18.48, longitude: lonAt(0), speedKmh: 30 }, [DEPOT], 80);
    expect(same.skipped).toBe(true);
  });
});
