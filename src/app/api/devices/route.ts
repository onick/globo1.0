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

  const { name, imei, vehiclePlate, vehicleType, driverName, driverPhone, tenantId: bodyTenantId } = await request.json();

  if (!name || !imei) {
    return NextResponse.json(
      { error: "Name and IMEI are required" },
      { status: 400 }
    );
  }

  // Resolve tenant: use session tenantId, or body tenantId for super_admin
  const resolvedTenantId = (tenantId as string) || (bodyTenantId as string);

  // super_admin without tenant: find or create a default one
  let finalTenantId = resolvedTenantId;
  if (!finalTenantId && role === "super_admin") {
    let defaultTenant = await db.tenant.findFirst({ where: { status: "active" } });
    if (!defaultTenant) {
      defaultTenant = await db.tenant.create({
        data: { name: "Default Fleet", slug: "default-fleet", status: "active", maxDevices: 100 },
      });
    }
    finalTenantId = defaultTenant.id;
  }

  if (!finalTenantId) {
    return NextResponse.json({ error: "No tenant associated" }, { status: 400 });
  }

  // Check device limit
  const tenant = await db.tenant.findUnique({
    where: { id: finalTenantId },
  });
  const deviceCount = await db.device.count({
    where: { tenantId: finalTenantId },
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
      tenantId: finalTenantId,
      traccarId,
      name,
      imei,
      vehiclePlate: vehiclePlate || null,
      vehicleType: vehicleType || null,
      driverName: driverName || null,
      driverPhone: driverPhone || null,
    },
  });

  return NextResponse.json(device, { status: 201 });
}
