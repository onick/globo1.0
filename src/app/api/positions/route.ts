import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { noClientResponse, tenantScope } from "@/lib/tenant-scope";
import { lastKnownPositions } from "@/lib/last-positions";

// GET /api/positions — current position of each of the tenant's devices: live when it
// reported in the last 5 minutes, otherwise the last one Traccar has
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = tenantScope(session.user as Record<string, unknown>);
  if (!scope) return noClientResponse();
  const where = { ...scope, traccarId: { not: null } };

  const devices = await db.device.findMany({
    where,
    select: {
      id: true,
      traccarId: true,
      name: true,
      vehiclePlate: true,
    },
  });

  // Live positions from the bridge (last 5 minutes); the rest at their last known place
  const live = devices.length
    ? await redis.mget(devices.map((d) => `device:pos:${d.traccarId}`))
    : [];
  const fallback = live.some((p) => p === null) ? await lastKnownPositions() : new Map();

  const positions = [];
  for (const [i, device] of devices.entries()) {
    const position = live[i] ? JSON.parse(live[i]!) : fallback.get(device.traccarId!);
    if (position) {
      positions.push({
        ...position,
        deviceName: device.name,
        vehiclePlate: device.vehiclePlate,
        globoDeviceId: device.id,
      });
    }
  }

  return NextResponse.json(positions);
}
