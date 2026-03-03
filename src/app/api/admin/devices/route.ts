import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const devices = await db.device.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { id: true, name: true } } },
  });

  const total = devices.length;
  const active = devices.filter((d) => d.status === "active").length;
  const inactive = devices.filter((d) => d.status === "inactive").length;
  const disabled = devices.filter((d) => d.status === "disabled").length;
  const activePct = total > 0 ? ((active / total) * 100).toFixed(1) : "0";

  return NextResponse.json({
    devices,
    stats: { total, active, inactive, disabled, activePct },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, imei, vehiclePlate, vehicleType, status, tenantId } = await request.json();

  if (!name || !imei || !tenantId) {
    return NextResponse.json({ error: "Name, IMEI, and Tenant are required" }, { status: 400 });
  }

  const existing = await db.device.findUnique({ where: { imei } });
  if (existing) {
    return NextResponse.json({ error: "A device with this IMEI already exists" }, { status: 409 });
  }

  const device = await db.device.create({
    data: {
      tenantId,
      name,
      imei,
      vehiclePlate: vehiclePlate || null,
      vehicleType: vehicleType || null,
      status: status || "active",
    },
  });

  return NextResponse.json(device, { status: 201 });
}
