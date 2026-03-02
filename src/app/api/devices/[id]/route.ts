import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";

// DELETE /api/devices/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
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
  const { id } = await params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (role !== "super_admin" && device.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await request.json();
  const updated = await db.device.update({
    where: { id },
    data: {
      name: data.name,
      vehiclePlate: data.vehiclePlate,
      vehicleType: data.vehicleType,
      status: data.status,
    },
  });

  return NextResponse.json(updated);
}
