import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";

// GET /api/devices — list devices for current tenant
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;

  const where = role === "super_admin" ? {} : { tenantId: tenantId as string };
  const devices = await db.device.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(devices);
}

// POST /api/devices — create a new device
export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, imei, vehiclePlate, vehicleType } = await request.json();

  if (!name || !imei) {
    return NextResponse.json(
      { error: "Name and IMEI are required" },
      { status: 400 }
    );
  }

  // Check device limit
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId as string },
  });
  const deviceCount = await db.device.count({
    where: { tenantId: tenantId as string },
  });
  if (tenant && deviceCount >= tenant.maxDevices) {
    return NextResponse.json(
      { error: `Device limit reached (${tenant.maxDevices})` },
      { status: 403 }
    );
  }

  // Create in Traccar first
  let traccarId: number | null = null;
  try {
    const traccarDevice = await traccar.createDevice(name, imei);
    traccarId = traccarDevice.id;
  } catch {
    // Traccar might not be running in dev — continue without it
    console.warn("Could not create device in Traccar, continuing without it");
  }

  // Create in Globo DB
  const device = await db.device.create({
    data: {
      tenantId: tenantId as string,
      traccarId,
      name,
      imei,
      vehiclePlate: vehiclePlate || null,
      vehicleType: vehicleType || null,
    },
  });

  return NextResponse.json(device, { status: 201 });
}
