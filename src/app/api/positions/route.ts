import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";

// GET /api/positions — get current positions for tenant's devices
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;

  // Get tenant's devices
  const where =
    role === "super_admin"
      ? { traccarId: { not: null as unknown as undefined } }
      : { tenantId: tenantId as string, traccarId: { not: null as unknown as undefined } };

  const devices = await db.device.findMany({
    where,
    select: {
      id: true,
      traccarId: true,
      name: true,
      vehiclePlate: true,
    },
  });

  // Get positions from Redis
  const positions = [];
  for (const device of devices) {
    const posData = await redis.get(`device:pos:${device.traccarId}`);
    if (posData) {
      positions.push({
        ...JSON.parse(posData),
        deviceName: device.name,
        vehiclePlate: device.vehiclePlate,
        globoDeviceId: device.id,
      });
    }
  }

  return NextResponse.json(positions);
}
