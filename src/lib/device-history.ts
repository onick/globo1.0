import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";
import {
  detectStops,
  knotsToKmh,
  parseRange,
  type RoutePoint,
  type RouteStop,
} from "@/lib/history";
import { matchRoute, type MatchedRoute } from "@/lib/map-matching";

export interface DeviceHistory {
  device: { id: string; name: string; vehiclePlate: string | null };
  from: Date;
  to: Date;
  points: RoutePoint[];
  stops: RouteStop[];
}

// Loads one device's positions and stops for ?deviceId=&from=&to=, checking the session
// and that the device belongs to the user's tenant. Shared by the history and the
// reports so both work on exactly the same data.
// Returns the error response to send when something is missing or not allowed.
export async function loadDeviceHistory(
  request: Request
): Promise<{ error: NextResponse } | { history: DeviceHistory }> {
  const fail = (message: string, status: number) => ({
    error: NextResponse.json({ error: message }, { status }),
  });

  const session = await auth();
  if (!session) return fail("Unauthorized", 401);

  const { tenantId, role } = session.user as Record<string, unknown>;
  const { searchParams } = new URL(request.url);

  const deviceId = searchParams.get("deviceId");
  if (!deviceId) return fail("deviceId is required", 400);

  const range = parseRange(searchParams.get("from"), searchParams.get("to"));
  if ("error" in range) return fail(range.error, 400);

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) return fail("Device not found", 404);
  if (role !== "super_admin" && device.tenantId !== tenantId) return fail("Forbidden", 403);
  if (!device.traccarId) return fail("Device is not linked to the GPS server", 409);

  let positions;
  let traccarStops;
  try {
    [positions, traccarStops] = await Promise.all([
      traccar.getRoute(device.traccarId, range.from, range.to),
      traccar.getStops(device.traccarId, range.from, range.to),
    ]);
  } catch (err) {
    console.error("History request to Traccar failed:", err);
    return fail("GPS server unavailable", 502);
  }

  const points: RoutePoint[] = positions
    .filter((p) => p.latitude !== 0 || p.longitude !== 0)
    .sort((a, b) => a.fixTime.localeCompare(b.fixTime))
    .map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      speedKmh: knotsToKmh(p.speed),
      course: p.course,
      time: p.fixTime,
      snapped: null,
      ignition: typeof p.attributes.ignition === "boolean" ? p.attributes.ignition : null,
    }));

  // Stops come from the positions (Traccar's stops report returns nothing for long
  // ranges); Traccar is only used for the address when it reports the same stop.
  const stops: RouteStop[] = detectStops(points).map((stop) => {
    const sameStop = traccarStops.find(
      (s) => s.startTime < stop.endTime && s.endTime > stop.startTime
    );
    return { ...stop, address: sameStop?.address ?? null };
  });

  return {
    history: {
      device: { id: device.id, name: device.name, vehiclePlate: device.vehiclePlate },
      from: range.from,
      to: range.to,
      points,
      stops,
    },
  };
}

// Snaps points to the roads when OSRM_URL is set. Null when it isn't configured or OSRM
// fails, so callers fall back to the GPS line instead of failing.
export async function snapToRoads(points: RoutePoint[]): Promise<MatchedRoute | null> {
  if (!process.env.OSRM_URL) return null;
  try {
    return await matchRoute(
      points,
      process.env.OSRM_URL,
      Number(process.env.OSRM_MATCH_MAX_POINTS) || undefined
    );
  } catch (err) {
    console.error("Map matching failed:", err);
    return null;
  }
}
