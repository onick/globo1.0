import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { traccar } from "@/lib/traccar";
import { can } from "@/lib/permissions";
import { detectStops, toRoutePoints } from "@/lib/history";
import { tripsWithRoadDistance } from "@/lib/device-history";
import { summarizeDay, type DayActivity } from "@/lib/dashboard";
import { dayBounds, dayKey, DEFAULT_TIME_ZONE } from "@/lib/time-zone";
import { currentState } from "@/lib/vehicle-state";

// The vehicle panel on the map polls this; Traccar and OSRM are asked at most this often
const CACHE_S = 30;

interface Telemetry {
  state: ReturnType<typeof currentState>;
  today: DayActivity;
  odometerKm: number | null;
  connection: { status: string; lastUpdate: string | null } | null;
}

async function telemetry(traccarId: number | null): Promise<Telemetry> {
  const timeZone = process.env.ALERT_TIMEZONE || DEFAULT_TIME_ZONE;
  const now = new Date();
  const { from: dayStart } = dayBounds(dayKey(now, timeZone), timeZone);
  if (!traccarId) return { state: null, today: summarizeDay([], 0), odometerKm: null, connection: null };

  // The last 24 h tell what it is doing and since when; today's part, its activity
  const points = toRoutePoints(await traccar.getRoute(traccarId, new Date(now.getTime() - 24 * 3600_000), now));
  const todayPoints = points.filter((p) => new Date(p.time) >= dayStart);
  const stops = detectStops(todayPoints);
  const today = summarizeDay(await tripsWithRoadDistance(todayPoints, stops), stops.length);

  // Connection and odometer (Traccar adds up the distance of every report)
  const device = await traccar.getDevice(traccarId);
  let odometerKm: number | null = null;
  if (device.positionId) {
    const [last] = await traccar.getPositionsById([device.positionId]);
    const meters = Number(last?.attributes?.totalDistance);
    if (Number.isFinite(meters)) odometerKm = Math.round(meters / 100) / 10;
  }
  return {
    state: currentState(points),
    today,
    odometerKm,
    connection: { status: device.status, lastUpdate: device.lastUpdate ?? null },
  };
}

// GET /api/devices/:id/overview — what the vehicle panel on the map shows: what it is doing
// and since when, today's activity, odometer, the tracker's connection and SIM, and its
// recent alerts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device || (role !== "super_admin" && device.tenantId !== tenantId)) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const key = `overview:${device.id}`;
  const cached = await redis.get(key);
  let data: Telemetry;
  if (cached) {
    data = JSON.parse(cached);
  } else {
    try {
      data = await telemetry(device.traccarId);
    } catch (err) {
      console.error("Vehicle overview failed:", err);
      return NextResponse.json({ error: "Could not load the vehicle's activity" }, { status: 502 });
    }
    await redis.set(key, JSON.stringify(data), "EX", CACHE_S);
  }

  const timeZone = process.env.ALERT_TIMEZONE || DEFAULT_TIME_ZONE;
  const { from: dayStart } = dayBounds(dayKey(new Date(), timeZone), timeZone);
  const [alertsToday, recentAlerts] = await Promise.all([
    db.alert.count({ where: { deviceId: device.id, time: { gte: dayStart } } }),
    db.alert.findMany({
      where: { deviceId: device.id },
      orderBy: { time: "desc" },
      take: 5,
      select: { id: true, type: true, time: true, speedKmh: true, limitKmh: true, readAt: true, geofence: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    ...data,
    tracker: { model: device.trackerModel, simNumber: device.simNumber, simCarrier: device.simCarrier },
    alerts: { today: alertsToday, recent: recentAlerts },
    permissions: { editDriver: can(role, "vehicles:edit"), configure: can(role, "vehicles:configure") },
  });
}
