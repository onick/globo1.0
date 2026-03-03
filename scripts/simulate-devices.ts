/**
 * Simulates GPS devices moving around Dominican Republic.
 * Creates devices in the DB and writes positions to Redis every 2 seconds.
 *
 * Usage: npx tsx scripts/simulate-devices.ts
 */

import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const db = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6380");

// Simulated vehicles around Dominican Republic
const VEHICLES = [
  { name: "Camión Logística #01", imei: "SIM001000000001", plate: "A-001234", type: "truck", lat: 18.4861, lng: -69.9312 },
  { name: "Moto Delivery #02", imei: "SIM002000000002", plate: "M-005678", type: "motorcycle", lat: 18.5001, lng: -69.9888 },
  { name: "Toyota Hilux #03", imei: "SIM003000000003", plate: "G-009012", type: "car", lat: 19.4517, lng: -70.6970 },
  { name: "Hyundai Accent #04", imei: "SIM004000000004", plate: "G-003456", type: "car", lat: 18.4274, lng: -68.9728 },
  { name: "Camión Frio #05", imei: "SIM005000000005", plate: "A-007890", type: "truck", lat: 18.7357, lng: -69.3857 },
  { name: "Moto Express #06", imei: "SIM006000000006", plate: "M-002345", type: "motorcycle", lat: 18.4722, lng: -69.8927 },
  { name: "Bus Ruta Norte #07", imei: "SIM007000000007", plate: "T-006789", type: "bus", lat: 19.2220, lng: -69.5397 },
  { name: "Ford Ranger #08", imei: "SIM008000000008", plate: "G-001122", type: "car", lat: 18.4533, lng: -69.9475 },
];

interface SimDevice {
  id: string;
  traccarId: number;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
}

async function setupDevices(): Promise<SimDevice[]> {
  // Find or create a demo tenant
  let tenant = await db.tenant.findFirst({ where: { slug: "demo-rd" } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: {
        name: "Demo RD",
        slug: "demo-rd",
        status: "active",
        maxDevices: 50,
      },
    });
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  }

  // NOTE: Do NOT link super_admin to demo tenant (cascade delete would remove it)

  const simDevices: SimDevice[] = [];

  for (let i = 0; i < VEHICLES.length; i++) {
    const v = VEHICLES[i];
    const traccarId = 9000 + i; // fake traccar IDs

    let device = await db.device.findFirst({ where: { imei: v.imei } });
    if (!device) {
      device = await db.device.create({
        data: {
          tenantId: tenant.id,
          traccarId,
          name: v.name,
          imei: v.imei,
          vehiclePlate: v.plate,
          vehicleType: v.type,
          status: "active",
        },
      });
    }

    simDevices.push({
      id: device.id,
      traccarId: device.traccarId!,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      speed: 0,
      course: Math.random() * 360,
    });
  }

  // Sync device-tenant mappings in Redis
  const pipeline = redis.pipeline();
  for (const d of simDevices) {
    pipeline.set(`device:tenant:${d.traccarId}`, tenant.id);
  }
  await pipeline.exec();

  console.log(`Setup ${simDevices.length} devices for tenant "${tenant.name}"`);
  return simDevices;
}

function moveDevice(d: SimDevice) {
  // Randomly adjust speed (0-120 km/h)
  if (Math.random() < 0.3) {
    d.speed = Math.random() < 0.1 ? 0 : Math.round(20 + Math.random() * 80);
  }

  // Randomly adjust course
  d.course += (Math.random() - 0.5) * 40;
  if (d.course < 0) d.course += 360;
  if (d.course >= 360) d.course -= 360;

  // Move based on speed and course
  if (d.speed > 0) {
    const distKm = (d.speed / 3600) * 2; // distance in 2 seconds
    const rad = (d.course * Math.PI) / 180;
    d.lat += (distKm / 111) * Math.cos(rad);
    d.lng += (distKm / (111 * Math.cos((d.lat * Math.PI) / 180))) * Math.sin(rad);

    // Keep within Dominican Republic bounds
    d.lat = Math.max(17.5, Math.min(19.95, d.lat));
    d.lng = Math.max(-72.0, Math.min(-68.3, d.lng));
  }
}

async function writePositions(devices: SimDevice[]) {
  const pipeline = redis.pipeline();
  for (const d of devices) {
    const posData = JSON.stringify({
      deviceId: d.traccarId,
      latitude: d.lat,
      longitude: d.lng,
      speed: d.speed,
      course: d.course,
      fixTime: new Date().toISOString(),
      attributes: {},
    });
    pipeline.set(`device:pos:${d.traccarId}`, posData, "EX", 300);
  }
  await pipeline.exec();
}

async function main() {
  console.log("Setting up simulated devices...");
  const devices = await setupDevices();

  console.log("Simulation running. Positions update every 2 seconds. Press Ctrl+C to stop.\n");

  const tick = async () => {
    for (const d of devices) {
      moveDevice(d);
    }
    await writePositions(devices);

    const moving = devices.filter((d) => d.speed > 0).length;
    const stopped = devices.length - moving;
    process.stdout.write(`\r  ${moving} moving | ${stopped} stopped | ${new Date().toLocaleTimeString()}`);
  };

  await tick();
  setInterval(tick, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
