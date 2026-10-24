import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { traccar } from "@/lib/traccar";
import { detectStops, toRoutePoints, STOP_MAX_SPEED_KMH } from "@/lib/history";
import { tripsWithRoadDistance } from "@/lib/device-history";
import {
  combineDays,
  describeDay,
  EMPTY_DAY,
  percentChange,
  summarizeDay,
  topVehicles,
  type DayActivity,
  type VehicleDay,
} from "@/lib/dashboard";
import { dayBounds, dayKey, DEFAULT_TIME_ZONE, lastDays } from "@/lib/time-zone";

const WEEK_DAYS = 7;
const TOP_VEHICLES = 7;
// Today keeps changing; past days only change if a tracker uploads late data
const TODAY_CACHE_S = 120;
const PAST_DAY_CACHE_S = 3600;
// Requests to Traccar at a time, so a big fleet doesn't flood it
const CONCURRENCY = 4;

interface Scope {
  tenantId: string | null;
  role: string;
}

type Device = { id: string; name: string; vehiclePlate: string | null; vehicleType: string | null; traccarId: number | null };

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// One vehicle's day, computed like the activity report and cached
async function deviceDay(device: Device, day: string, timeZone: string, isToday: boolean): Promise<DayActivity> {
  if (!device.traccarId) return EMPTY_DAY;
  const key = `dash:day:${device.id}:${day}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const { from, to } = dayBounds(day, timeZone);
  const points = toRoutePoints(await traccar.getRoute(device.traccarId, from, to));
  const stops = detectStops(points);
  const trips = await tripsWithRoadDistance(points, stops);
  const activity = summarizeDay(trips, stops.length);

  await redis.set(key, JSON.stringify(activity), "EX", isToday ? TODAY_CACHE_S : PAST_DAY_CACHE_S);
  return activity;
}

export async function loadDashboard(scope: Scope) {
  const timeZone = process.env.ALERT_TIMEZONE || DEFAULT_TIME_ZONE;
  const now = new Date();
  const days = lastDays(now, WEEK_DAYS, timeZone);
  const todayKey = dayKey(now, timeZone);

  const where = scope.role === "super_admin" ? {} : { tenantId: scope.tenantId ?? "" };
  const devices: Device[] = await db.device.findMany({
    where,
    select: { id: true, name: true, vehiclePlate: true, vehicleType: true, traccarId: true },
    orderBy: { name: "asc" },
  });

  // Every vehicle, every day of the week (oldest first)
  const perDay = await mapLimit(days, 1, (day) =>
    mapLimit(devices, CONCURRENCY, (d) => deviceDay(d, day, timeZone, day === todayKey))
  );
  const todayByVehicle: VehicleDay[] = devices.map((d, i) => ({
    id: d.id,
    name: d.name,
    vehiclePlate: d.vehiclePlate,
    vehicleType: d.vehicleType,
    ...perDay[WEEK_DAYS - 1][i],
  }));
  const week = days.map((day, i) => ({ date: day, ...combineDays(perDay[i]) }));
  const today = week[WEEK_DAYS - 1];
  const yesterday = week[WEEK_DAYS - 2];

  // Live state: the bridge keeps the last position of each reporting vehicle for 5 minutes
  const linked = devices.filter((d) => d.traccarId);
  const live = linked.length ? await redis.mget(linked.map((d) => `device:pos:${d.traccarId}`)) : [];
  const positions = live.filter((p): p is string => p !== null).map((p) => JSON.parse(p) as { speed: number });

  const { from: todayFrom } = dayBounds(todayKey, timeZone);
  const alertWhere = { ...where, time: { gte: todayFrom } };
  const [byType, unread] = await Promise.all([
    db.alert.groupBy({ by: ["type"], where: alertWhere, _count: true }),
    db.alert.count({ where: { ...where, readAt: null } }),
  ]);
  const alertCount = (type: string) => byType.find((g) => g.type === type)?._count ?? 0;
  const alertsToday = {
    total: byType.reduce((sum, g) => sum + g._count, 0),
    unread,
    geofenceEnter: alertCount("geofence_enter"),
    geofenceExit: alertCount("geofence_exit"),
    overspeed: alertCount("overspeed"),
  };

  const movedVehicles = todayByVehicle.filter((v) => v.distanceKm > 0).length;

  return {
    timeZone,
    generatedAt: now.toISOString(),
    // Today in the fleet's time zone, for links to the map history
    todayFrom: todayFrom.toISOString(),
    todayTo: now.toISOString(),
    vehicles: {
      total: devices.length,
      reporting: positions.length,
      moving: positions.filter((p) => p.speed > STOP_MAX_SPEED_KMH).length,
      notReporting: devices.length - positions.length,
      movedToday: movedVehicles,
    },
    today: {
      ...today,
      distanceVsYesterdayPct: percentChange(today.distanceKm, yesterday.distanceKm),
      drivingVsYesterdayPct: percentChange(today.drivingMin, yesterday.drivingMin),
    },
    week,
    topVehicles: topVehicles(todayByVehicle, TOP_VEHICLES),
    alertsToday,
    insight: describeDay({
      movedVehicles,
      totalVehicles: devices.length,
      today,
      speedingAlerts: alertsToday.overspeed,
    }),
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof loadDashboard>>;
