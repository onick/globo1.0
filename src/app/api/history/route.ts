import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";
import {
  detectStops,
  knotsToKmh,
  parseRange,
  summarizeRoute,
  type RoutePoint,
  type RouteStop,
} from "@/lib/history";
import { matchRoute, type MatchedRoute } from "@/lib/map-matching";

// GET /api/history?deviceId=<globo device id>&from=<ISO>&to=<ISO>
// Route, stops and summary for one device over a time range. With OSRM_URL set, the
// route is snapped to the roads; otherwise it is the line between GPS fixes.
export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  const { searchParams } = new URL(request.url);

  const deviceId = searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  const range = parseRange(searchParams.get("from"), searchParams.get("to"));
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (role !== "super_admin" && device.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!device.traccarId) {
    return NextResponse.json(
      { error: "Device is not linked to the GPS server" },
      { status: 409 }
    );
  }

  let positions;
  let traccarStops;
  try {
    [positions, traccarStops] = await Promise.all([
      traccar.getRoute(device.traccarId, range.from, range.to),
      traccar.getStops(device.traccarId, range.from, range.to),
    ]);
  } catch (err) {
    console.error("History request to Traccar failed:", err);
    return NextResponse.json(
      { error: "GPS server unavailable" },
      { status: 502 }
    );
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
    }));

  let matched: MatchedRoute | null = null;
  if (process.env.OSRM_URL) {
    try {
      matched = await matchRoute(
        points,
        process.env.OSRM_URL,
        Number(process.env.OSRM_MATCH_MAX_POINTS) || undefined
      );
    } catch (err) {
      // Fall back to the GPS line rather than failing the whole history
      console.error("Map matching failed:", err);
    }
  }
  matched?.snapped.forEach((location, i) => {
    points[i].snapped = location;
  });

  // Stops come from the positions (Traccar's stops report returns nothing for long
  // ranges); Traccar is only used for the address when it reports the same stop.
  const stops: RouteStop[] = detectStops(points).map((stop) => {
    const sameStop = traccarStops.find(
      (s) => s.startTime < stop.endTime && s.endTime > stop.startTime
    );
    return { ...stop, address: sameStop?.address ?? null };
  });

  return NextResponse.json({
    device: {
      id: device.id,
      name: device.name,
      vehiclePlate: device.vehiclePlate,
    },
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    points,
    stops,
    route: matched ? { snappedToRoads: true, segments: matched.segments } : null,
    summary: summarizeRoute(points, matched ? matched.distanceKm : null),
  });
}
