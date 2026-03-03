import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (body.imei) {
    const existing = await db.device.findFirst({
      where: { imei: body.imei, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "A device with this IMEI already exists" }, { status: 409 });
    }
  }

  const device = await db.device.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.imei !== undefined && { imei: body.imei }),
      ...(body.vehiclePlate !== undefined && { vehiclePlate: body.vehiclePlate || null }),
      ...(body.vehicleType !== undefined && { vehicleType: body.vehicleType || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.tenantId !== undefined && { tenantId: body.tenantId }),
    },
  });

  return NextResponse.json(device);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.device.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
