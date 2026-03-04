/**
 * Seed demo devices + fake positions for visual testing.
 * Run: npx tsx scripts/seed-demo-devices.ts
 */

import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const db = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Dominican Republic area — Santo Domingo region
const DEMO_DEVICES = [
  {
    name: "Camión SD-01",
    imei: "860012345678901",
    vehiclePlate: "A-123-456",
    vehicleType: "truck",
    driverName: "Carlos Méndez",
    driverPhone: "+18095551234",
    traccarId: 99001,
    position: {
      latitude: 18.4861,
      longitude: -69.9312,
      speed: 45,
      course: 90,
    },
  },
  {
    name: "Furgoneta Norte",
    imei: "860012345678902",
    vehiclePlate: "B-789-012",
    vehicleType: "van",
    driverName: "Ana Rodríguez",
    driverPhone: "+18095555678",
    traccarId: 99002,
    position: {
      latitude: 18.5105,
      longitude: -69.8872,
      speed: 0,
      course: 180,
    },
  },
  {
    name: "Moto Delivery #3",
    imei: "860012345678903",
    vehiclePlate: "M-345-678",
    vehicleType: "motorcycle",
    driverName: "José Ramírez",
    driverPhone: "+18095559012",
    traccarId: 99003,
    position: {
      latitude: 18.4723,
      longitude: -69.9109,
      speed: 28,
      course: 315,
    },
  },
  {
    name: "Pickup Zona Colonial",
    imei: "860012345678904",
    vehiclePlate: "C-901-234",
    vehicleType: "pickup",
    driverName: null,
    driverPhone: null,
    traccarId: 99004,
    position: {
      latitude: 18.4735,
      longitude: -69.8826,
      speed: 0,
      course: 45,
    },
  },
  {
    name: "Camión Refrigerado",
    imei: "860012345678905",
    vehiclePlate: "D-567-890",
    vehicleType: "truck",
    driverName: "María Santos",
    driverPhone: "+18095553456",
    traccarId: 99005,
    position: null, // offline device — no position
  },
];

async function main() {
  console.log("🌱 Seeding demo devices...\n");

  // Find or create a tenant
  let tenant = await db.tenant.findFirst({ where: { status: "active" } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: {
        name: "Demo Fleet",
        slug: "demo-fleet",
        status: "active",
        maxDevices: 50,
      },
    });
    console.log(`  ✅ Created tenant: ${tenant.name} (${tenant.id})`);
  } else {
    console.log(`  📦 Using tenant: ${tenant.name} (${tenant.id})`);
  }

  // Assign super_admin user to tenant if not assigned
  const superAdmin = await db.user.findFirst({
    where: { role: "super_admin" },
  });
  if (superAdmin && !superAdmin.tenantId) {
    await db.user.update({
      where: { id: superAdmin.id },
      data: { tenantId: tenant.id },
    });
    console.log(`  🔗 Linked super_admin to tenant\n`);
  }

  for (const device of DEMO_DEVICES) {
    // Upsert device
    const created = await db.device.upsert({
      where: { imei: device.imei },
      update: {
        name: device.name,
        traccarId: device.traccarId,
        vehiclePlate: device.vehiclePlate,
        vehicleType: device.vehicleType,
        driverName: device.driverName,
        driverPhone: device.driverPhone,
        status: "active",
      },
      create: {
        tenantId: tenant.id,
        name: device.name,
        imei: device.imei,
        traccarId: device.traccarId,
        vehiclePlate: device.vehiclePlate,
        vehicleType: device.vehicleType,
        driverName: device.driverName,
        driverPhone: device.driverPhone,
        status: "active",
      },
    });
    console.log(`  📍 Device: ${created.name} (traccarId: ${device.traccarId})`);

    // Seed position in Redis
    if (device.position) {
      const posData = {
        deviceId: device.traccarId,
        latitude: device.position.latitude,
        longitude: device.position.longitude,
        speed: device.position.speed,
        course: device.position.course,
        fixTime: new Date().toISOString(),
      };

      await redis.set(
        `device:pos:${device.traccarId}`,
        JSON.stringify(posData),
        "EX",
        600 // 10 min TTL for demo
      );
      console.log(
        `     → Position: ${device.position.latitude}, ${device.position.longitude} | ${device.position.speed} km/h`
      );
    } else {
      console.log(`     → Offline (no position)`);
    }
  }

  console.log("\n✅ Done! Go to /map to see the devices.\n");

  await db.$disconnect();
  redis.disconnect();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
