import { NextResponse } from "next/server";
import { parseSpeedLimit } from "@/lib/speed-limit";
import { parseDeviceConfig } from "@/lib/device-config";
import { validateImei } from "@/lib/trackers";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { forbiddenResponse, noClientResponse, tenantScope } from "@/lib/tenant-scope";
import { traccar } from "@/lib/traccar";
import { redis } from "@/lib/redis";

// GET /api/devices — list devices for current tenant
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = tenantScope(session.user as Record<string, unknown>);
  if (!where) return noClientResponse();
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
  if (!can(role, "vehicles:create")) return forbiddenResponse();

  const body = await request.json();
  const { name, imei, vehiclePlate, vehicleType, driverName, driverPhone, speedLimitKmh, tenantId: bodyTenantId } = body;

  const speedLimit = parseSpeedLimit(speedLimitKmh);
  if ("error" in speedLimit) {
    return NextResponse.json({ error: speedLimit.error }, { status: 400 });
  }

  // Tracker model and SIM, if given: only roles that configure trackers may set them
  const config = parseDeviceConfig(body);
  if ("error" in config) {
    return NextResponse.json({ error: config.error }, { status: 400 });
  }
  if (Object.keys(config.data).length && !can(role, "vehicles:configure")) return forbiddenResponse();

  if (!name || !imei) {
    return NextResponse.json(
      { error: "Name and IMEI are required" },
      { status: 400 }
    );
  }
  const checkedImei = validateImei(imei);
  if ("error" in checkedImei) return NextResponse.json({ error: checkedImei.error }, { status: 400 });
  if (await db.device.findUnique({ where: { imei: checkedImei.imei } })) {
    return NextResponse.json({ error: "A device with this IMEI already exists" }, { status: 409 });
  }

  // Client users add to their own client; only super admins may name one
  if (role !== "super_admin" && !tenantId) return noClientResponse();
  const resolvedTenantId = role === "super_admin" ? (bodyTenantId as string) || (tenantId as string) : (tenantId as string);

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
  if (!tenant) return NextResponse.json({ error: "Client not found" }, { status: 400 });
  const deviceCount = await db.device.count({
    where: { tenantId: finalTenantId },
  });
  if (deviceCount >= tenant.maxDevices) {
    return NextResponse.json(
      { error: `Device limit reached (${tenant.maxDevices})` },
      { status: 403 }
    );
  }

  // Create in Traccar first
  let traccarId: number | null = null;
  try {
    const traccarDevice = await traccar.createDevice(name, checkedImei.imei);
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
      imei: checkedImei.imei,
      vehiclePlate: vehiclePlate || null,
      vehicleType: vehicleType || null,
      driverName: driverName || null,
      driverPhone: driverPhone || null,
      speedLimitKmh: speedLimit.value ?? null,
      ...config.data,
    },
  });
  // The live bridge routes positions to the vehicle's client
  if (traccarId) await redis.set(`device:tenant:${traccarId}`, finalTenantId);

  return NextResponse.json(device, { status: 201 });
}
