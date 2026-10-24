import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { forbiddenResponse } from "@/lib/tenant-scope";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";
import { invalidateAlertCache } from "@/lib/alert-processor";
import { parseSpeedLimit } from "@/lib/speed-limit";

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
    },
  });
  if (limit !== undefined) invalidateAlertCache();

  return NextResponse.json(updated);
}
