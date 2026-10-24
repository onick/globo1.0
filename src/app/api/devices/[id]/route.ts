import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { forbiddenResponse } from "@/lib/tenant-scope";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";
import { invalidateAlertCache } from "@/lib/alert-processor";
import { parseSpeedLimit } from "@/lib/speed-limit";
import { parseDeviceConfig } from "@/lib/device-config";

// GET /api/devices/:id — the device with its tracker and SIM settings and the trackers it
// has had. The APN password only goes to roles that may configure the tracker.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  const { id } = await params;

  const device = await db.device.findUnique({
    where: { id },
    include: {
      tenant: { select: { name: true } },
      imeiChanges: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!device || (role !== "super_admin" && device.tenantId !== tenantId)) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const canConfigure = can(role, "vehicles:configure");
  return NextResponse.json({
    ...device,
    apnPassword: canConfigure ? device.apnPassword : null,
    // Public address of Globo's Traccar, where trackers must send their positions
    serverHost: process.env.TRACKER_SERVER_HOST || null,
    permissions: {
      edit: can(role, "vehicles:edit"),
      configure: canConfigure,
      delete: can(role, "vehicles:delete"),
    },
  });
}

// DELETE /api/devices/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (!can(role, "vehicles:delete")) return forbiddenResponse();
  const { id } = await params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (role !== "super_admin" && device.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete from Traccar
  if (device.traccarId) {
    try {
      await traccar.deleteDevice(device.traccarId);
    } catch {
      console.warn("Could not delete device from Traccar");
    }
  }

  // Delete from Globo DB
  await db.device.delete({ where: { id } });

  return NextResponse.json({ message: "Device deleted" });
}

// PATCH /api/devices/:id
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (!can(role, "vehicles:edit")) return forbiddenResponse();
  const { id } = await params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (role !== "super_admin" && device.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await request.json();

  const speedLimit = parseSpeedLimit(data.speedLimitKmh);
  if ("error" in speedLimit) {
    return NextResponse.json({ error: speedLimit.error }, { status: 400 });
  }
  const limit = speedLimit.value;

  // Tracker and SIM settings need more than editing the vehicle
  const config = parseDeviceConfig(data);
  if ("error" in config) {
    return NextResponse.json({ error: config.error }, { status: 400 });
  }
  if (Object.keys(config.data).length && !can(role, "vehicles:configure")) return forbiddenResponse();

  const updated = await db.device.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.vehiclePlate !== undefined && { vehiclePlate: data.vehiclePlate }),
      ...(data.vehicleType !== undefined && { vehicleType: data.vehicleType }),
      ...(data.driverName !== undefined && { driverName: data.driverName }),
      ...(data.driverPhone !== undefined && { driverPhone: data.driverPhone }),
      ...(data.status !== undefined && { status: data.status }),
      ...(limit !== undefined && { speedLimitKmh: limit }),
      ...config.data,
    },
  });
  if (limit !== undefined) invalidateAlertCache();

  return NextResponse.json(updated);
}
