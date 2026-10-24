/**
 * Imports a client's fleet from another platform: the client, its vehicles and the last
 * position of each one. Safe to run again: existing vehicles are updated, positions that
 * Traccar already has are not sent twice.
 *
 * Usage: node --env-file=.env --import tsx scripts/import-fleet.ts <fleet.json>
 *   DATABASE_URL, TRACCAR_API_URL, TRACCAR_ADMIN_EMAIL, TRACCAR_ADMIN_PASSWORD  (from .env)
 *   TRACCAR_OSMAND_URL  OsmAnd port of Traccar (default http://localhost:5055)
 *
 * fleet.json:
 * {
 *   "tenant": { "name": "Flota X", "slug": "flota-x" },
 *   "vehicles": [{
 *     "name": "Hyundai Sonata", "imei": "868720065147146", "plate": "AA08376",
 *     "vehicleType": "car",                       // truck, van, car, pickup, motorcycle, bus or null
 *     "trackerModel": "concox-gt06n",             // optional, an id from src/lib/trackers.ts
 *     "simNumber": "8096728477", "simCarrier": "Claro", "apn": "…",   // optional
 *     "lastPosition": { "latitude": 18.46, "longitude": -69.30, "speedKmh": 0,
 *                       "course": 248, "time": "2026-10-24T18:43:11Z" }   // optional
 *   }]
 * }
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/slug";
import { parseDeviceConfig } from "../src/lib/device-config";

interface FleetVehicle {
  name: string;
  imei: string;
  plate?: string | null;
  vehicleType?: string | null;
  trackerModel?: string | null;
  simNumber?: string | null;
  simCarrier?: string | null;
  apn?: string | null;
  lastPosition?: { latitude: number; longitude: number; speedKmh: number; course: number; time: string } | null;
}

interface Fleet {
  tenant: { name: string; slug?: string };
  vehicles: FleetVehicle[];
}

const TRACCAR_API = process.env.TRACCAR_API_URL || "http://localhost:8082/api";
const OSMAND_URL = process.env.TRACCAR_OSMAND_URL || "http://localhost:5055";
// Requests to Traccar at a time
const CONCURRENCY = 8;

const db = new PrismaClient();

async function traccarSession(): Promise<string> {
  const res = await fetch(`${TRACCAR_API}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: process.env.TRACCAR_ADMIN_EMAIL || "",
      password: process.env.TRACCAR_ADMIN_PASSWORD || "",
    }),
  });
  if (!res.ok) throw new Error(`Traccar login failed: ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0];
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: scripts/import-fleet.ts <fleet.json>");
  const fleet: Fleet = JSON.parse(readFileSync(file, "utf8"));

  const slug = fleet.tenant.slug || slugify(fleet.tenant.name);
  let tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: fleet.tenant.name, slug, status: "active", maxDevices: fleet.vehicles.length },
    });
    console.log(`Created client ${tenant.name}`);
  } else if (tenant.maxDevices < fleet.vehicles.length) {
    tenant = await db.tenant.update({ where: { id: tenant.id }, data: { maxDevices: fleet.vehicles.length } });
  }

  const cookie = await traccarSession();
  const traccarDevices: { id: number; uniqueId: string; lastUpdate: string | null }[] = await fetch(
    `${TRACCAR_API}/devices`,
    { headers: { Cookie: cookie } }
  ).then((r) => r.json());
  const byImei = new Map(traccarDevices.map((d) => [d.uniqueId, d]));

  const counts = { created: 0, updated: 0, positions: 0, skipped: [] as string[] };

  await mapLimit(fleet.vehicles, CONCURRENCY, async (v) => {
    // A vehicle that belongs to another client stays where it is
    const existing = await db.device.findUnique({ where: { imei: v.imei } });
    if (existing && existing.tenantId !== tenant.id) {
      counts.skipped.push(`${v.imei} (belongs to another client)`);
      return;
    }

    let traccarDevice = byImei.get(v.imei);
    if (!traccarDevice) {
      const res = await fetch(`${TRACCAR_API}/devices`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.name, uniqueId: v.imei }),
      });
      if (!res.ok) {
        counts.skipped.push(`${v.imei} (Traccar: ${res.status})`);
        return;
      }
      traccarDevice = { ...(await res.json()), lastUpdate: null };
    }

    // Tracker and SIM, checked like the device page does; a bad value is skipped, not fatal
    const config = parseDeviceConfig({
      ...(v.trackerModel !== undefined && { trackerModel: v.trackerModel }),
      ...(v.simNumber !== undefined && { simNumber: v.simNumber }),
      ...(v.simCarrier !== undefined && { simCarrier: v.simCarrier }),
      ...(v.apn !== undefined && { apn: v.apn }),
    });
    if ("error" in config) counts.skipped.push(`${v.imei} (tracker/SIM: ${config.error}, imported without them)`);

    const data = {
      name: v.name,
      vehiclePlate: v.plate || null,
      vehicleType: v.vehicleType || null,
      traccarId: traccarDevice!.id,
      ...("data" in config ? config.data : {}),
    };
    if (existing) {
      await db.device.update({ where: { id: existing.id }, data });
      counts.updated++;
    } else {
      await db.device.create({ data: { ...data, tenantId: tenant.id, imei: v.imei, status: "active" } });
      counts.created++;
    }

    // Last position, as the tracker would have sent it (OsmAnd takes knots)
    const p = v.lastPosition;
    if (p && !(traccarDevice!.lastUpdate && new Date(traccarDevice!.lastUpdate) >= new Date(p.time))) {
      const query = new URLSearchParams({
        id: v.imei,
        lat: String(p.latitude),
        lon: String(p.longitude),
        timestamp: String(Math.floor(new Date(p.time).getTime() / 1000)),
        speed: (p.speedKmh / 1.852).toFixed(2),
        bearing: String(Math.round(p.course)),
      });
      const res = await fetch(`${OSMAND_URL}/?${query}`);
      if (res.ok) counts.positions++;
      else counts.skipped.push(`${v.imei} (position: ${res.status})`);
    }
  });

  console.log(
    `${tenant.name}: ${counts.created} vehicles created, ${counts.updated} updated, ${counts.positions} positions sent`
  );
  if (counts.skipped.length) console.log(`Skipped ${counts.skipped.length}:\n  ${counts.skipped.join("\n  ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
