import { NextResponse } from "next/server";
import { loadDeviceHistory, tripsWithRoadDistance } from "@/lib/device-history";
import { DEFAULT_SPEED_LIMIT_KMH, detectIdle, detectSpeeding } from "@/lib/activity";

// GET /api/reports/activity?deviceId=&from=&to=&speedLimit=80
// Trips, stops, idling and speeding for one device over a time range.
export async function GET(request: Request) {
  const loaded = await loadDeviceHistory(request);
  if ("error" in loaded) return loaded.error;
  const { device, from, to, points, stops } = loaded.history;

  const limitParam = new URL(request.url).searchParams.get("speedLimit");
  const speedLimit = limitParam === null ? DEFAULT_SPEED_LIMIT_KMH : Number(limitParam);
  if (!Number.isFinite(speedLimit) || speedLimit < 10 || speedLimit > 200) {
    return NextResponse.json(
      { error: "speedLimit must be between 10 and 200 km/h" },
      { status: 400 }
    );
  }

  // Trip distance along the roads when OSRM can match it, else between GPS fixes
  const trips = await tripsWithRoadDistance(points, stops);

  const idle = detectIdle(points);
  const speeding = detectSpeeding(points, speedLimit);

  const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

  return NextResponse.json({
    device,
    from: from.toISOString(),
    to: to.toISOString(),
    trips,
    stops,
    // null: the device doesn't report ignition, so idling can't be told from parking
    idle,
    speeding: { limitKmh: speedLimit, events: speeding },
    totals: {
      trips: trips.length,
      distanceKm: sum(trips.map((t) => t.distanceKm)),
      drivingMin: sum(trips.map((t) => t.durationMin)),
      stops: stops.length,
      stoppedMin: sum(stops.map((s) => s.durationMin)),
      idleMin: idle ? sum(idle.map((p) => p.durationMin)) : null,
      speedingEvents: speeding.length,
      maxSpeedKmh: points.length ? Math.max(...points.map((p) => Math.round(p.speedKmh * 10) / 10)) : 0,
    },
  });
}
