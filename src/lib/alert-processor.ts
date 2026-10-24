// Runs the alert engine on the positions the Traccar bridge receives and stores the alerts.

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { DEFAULT_SPEED_LIMIT_KMH } from "@/lib/activity";
import { knotsToKmh } from "@/lib/history";
import {
  evaluatePosition,
  type DeviceAlertState,
  type EngineGeofence,
} from "@/lib/alert-engine";

export interface BridgePosition {
  deviceId: number; // Traccar id
  latitude: number;
  longitude: number;
  speed: number; // knots
  fixTime: string;
}

interface DeviceInfo {
  id: string;
  tenantId: string;
  speedLimitKmh: number;
}

// Devices and geofences change rarely; reload them at most this often
const CACHE_TTL_MS = 30_000;
let cache: {
  loadedAt: number;
  devices: Map<number, DeviceInfo>;
  geofences: Map<string, EngineGeofence[]>;
} | null = null;

// Call after editing geofences or speed limits so the next position uses them
export function invalidateAlertCache() {
  cache = null;
}

async function loadCache() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const [devices, geofences] = await Promise.all([
    db.device.findMany({
      where: { traccarId: { not: null } },
      select: { id: true, tenantId: true, traccarId: true, speedLimitKmh: true },
    }),
    db.geofence.findMany(),
  ]);

  const byTenant = new Map<string, EngineGeofence[]>();
  for (const g of geofences) {
    const list = byTenant.get(g.tenantId) ?? [];
    list.push({ id: g.id, latitude: g.latitude, longitude: g.longitude, radiusM: g.radiusM });
    byTenant.set(g.tenantId, list);
  }

  cache = {
    loadedAt: Date.now(),
    devices: new Map(
      devices.map((d) => [
        d.traccarId!,
        { id: d.id, tenantId: d.tenantId, speedLimitKmh: d.speedLimitKmh ?? DEFAULT_SPEED_LIMIT_KMH },
      ])
    ),
    geofences: byTenant,
  };
  return cache;
}

const stateKey = (traccarId: number) => `alert:state:${traccarId}`;

// Positions of one device are evaluated in fix-time order; a batch from Traccar can mix
// devices and arrive unordered.
export async function processAlerts(positions: BridgePosition[]) {
  const { devices, geofences } = await loadCache();

  const byDevice = new Map<number, BridgePosition[]>();
  for (const p of positions) {
    if (!devices.has(p.deviceId)) continue; // not a Globo device
    const list = byDevice.get(p.deviceId) ?? [];
    list.push(p);
    byDevice.set(p.deviceId, list);
  }

  for (const [traccarId, list] of byDevice) {
    const device = devices.get(traccarId)!;
    const fences = geofences.get(device.tenantId) ?? [];
    const raw = await redis.get(stateKey(traccarId));
    let state: DeviceAlertState | null = raw ? JSON.parse(raw) : null;

    const alerts = [];
    for (const p of list.sort((a, b) => a.fixTime.localeCompare(b.fixTime))) {
      const result = evaluatePosition(
        state,
        { time: p.fixTime, latitude: p.latitude, longitude: p.longitude, speedKmh: knotsToKmh(p.speed) },
        fences,
        device.speedLimitKmh
      );
      state = result.state;
      alerts.push(...result.alerts);
    }

    if (state) await redis.set(stateKey(traccarId), JSON.stringify(state));
    if (!alerts.length) continue;

    await db.alert.createMany({
      data: alerts.map((a) => ({
        tenantId: device.tenantId,
        deviceId: device.id,
        type: a.type,
        geofenceId: a.geofenceId,
        time: new Date(a.time),
        latitude: a.latitude,
        longitude: a.longitude,
        speedKmh: a.speedKmh,
        limitKmh: a.limitKmh,
        dedupKey: `${device.id}:${a.type}:${a.geofenceId ?? ""}:${new Date(a.time).toISOString()}`,
      })),
      skipDuplicates: true,
    });
  }
}
