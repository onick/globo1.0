import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { traccar } from "@/lib/traccar";

async function superAdmin() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// PATCH /api/admin/devices/:id — quick edit, including moving the vehicle to another client.
// The IMEI is changed with POST /api/devices/:id/imei, which keeps its history and Traccar
// in step.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await superAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  if (body.imei !== undefined && body.imei !== device.imei) {
    return NextResponse.json(
      { error: "Change the IMEI with \"Replace IMEI\" on the device page, so its history and the tracker server stay in step" },
      { status: 400 }
    );
  }
  if (body.tenantId !== undefined && !(await db.tenant.findUnique({ where: { id: body.tenantId } }))) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const updated = await db.device.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.vehiclePlate !== undefined && { vehiclePlate: body.vehiclePlate || null }),
      ...(body.vehicleType !== undefined && { vehicleType: body.vehicleType || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.tenantId !== undefined && { tenantId: body.tenantId }),
    },
  });
  // The live bridge routes positions to the vehicle's client
  if (updated.traccarId && updated.tenantId !== device.tenantId) {
    await redis.set(`device:tenant:${updated.traccarId}`, updated.tenantId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await superAdmin();
  if (denied) return denied;

  const { id } = await params;
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

  if (device.traccarId) {
    try {
      await traccar.deleteDevice(device.traccarId);
    } catch {
      console.warn("Could not delete device from Traccar");
    }
  }
  await db.device.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
