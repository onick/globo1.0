import { redis } from "@/lib/redis";
import { traccar } from "@/lib/traccar";
import { toRoutePoints } from "@/lib/history";
import { snapToRoads } from "@/lib/device-history";

type LngLat = [number, number];

// How far back the live trail goes
export const TRAIL_MINUTES = 10;
// Each vehicle's trail is matched again at most this often, whoever is watching
const CACHE_S = 15;
// Vehicles matched at a time, so a big fleet doesn't flood Traccar and OSRM
const CONCURRENCY = 4;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

// The last minutes of one vehicle along the roads, as separate lines: where OSRM couldn't
// match a stretch there is a gap rather than a straight line through the blocks. Without
// OSRM (not configured or down) it is the GPS line.
async function trailOf(traccarId: number): Promise<LngLat[][]> {
  const key = `trail:${traccarId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const to = new Date();
  const from = new Date(to.getTime() - TRAIL_MINUTES * 60_000);
  const points = toRoutePoints(await traccar.getRoute(traccarId, from, to));
  let lines: LngLat[][] = [];
  if (points.length >= 2) {
    const matched = await snapToRoads(points);
    lines = matched ? matched.segments : [points.map((p) => [p.longitude, p.latitude] as LngLat)];
  }
  await redis.set(key, JSON.stringify(lines), "EX", CACHE_S);
  return lines;
}

// Trails of the vehicles that are reporting now (live position in Redis), by Traccar id
export async function liveTrails(traccarIds: number[]): Promise<Record<number, LngLat[][]>> {
  const live = traccarIds.length ? await redis.mget(traccarIds.map((id) => `device:pos:${id}`)) : [];
  const reporting = traccarIds.filter((_, i) => live[i] !== null);

  const trails: Record<number, LngLat[][]> = {};
  await mapLimit(reporting, CONCURRENCY, async (id) => {
    try {
      const lines = await trailOf(id);
      if (lines.length) trails[id] = lines;
    } catch (err) {
      console.warn(`Could not load the live trail of device ${id}:`, err);
    }
  });
  return trails;
}
