import { redis } from "@/lib/redis";
import { traccar } from "@/lib/traccar";
import { knotsToKmh } from "@/lib/history";

const CACHE_KEY = "traccar:last-positions";
// The live map polls every few seconds; Traccar is asked at most once a minute
const CACHE_S = 60;

export interface LivePosition {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  course: number;
  fixTime: string;
  attributes: Record<string, unknown>;
}

// Last position Traccar has for every device, by Traccar id. Vehicles that stopped
// reporting keep showing where they were last seen instead of vanishing from the map.
export async function lastKnownPositions(): Promise<Map<number, LivePosition>> {
  const cached = await redis.get(CACHE_KEY);
  let list: LivePosition[];
  if (cached) {
    list = JSON.parse(cached);
  } else {
    try {
      // Traccar's own "latest positions" list leaves some devices out: ask by id instead
      const ids = (await traccar.getDevices()).flatMap((d) => (d.positionId ? [d.positionId] : []));
      list = (await traccar.getPositionsById(ids)).map((p) => ({
        deviceId: p.deviceId,
        latitude: p.latitude,
        longitude: p.longitude,
        speed: knotsToKmh(p.speed),
        course: p.course,
        fixTime: p.fixTime,
        attributes: p.attributes,
      }));
    } catch (err) {
      console.warn("Could not load last positions from Traccar:", err);
      return new Map();
    }
    await redis.set(CACHE_KEY, JSON.stringify(list), "EX", CACHE_S);
  }
  return new Map(list.map((p) => [p.deviceId, p]));
}
