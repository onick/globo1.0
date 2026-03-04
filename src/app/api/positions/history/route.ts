import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";

// GET /api/positions/history?deviceId=xxx&from=ISO&to=ISO
export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  const { searchParams } = new URL(request.url);

  const deviceId = searchParams.get("deviceId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!deviceId || !from || !to) {
    return NextResponse.json(
      { error: "Missing deviceId, from, or to parameters" },
      { status: 400 }
    );
  }

  // Verify device belongs to tenant (or user is super_admin)
  const device = await db.device.findFirst({
    where: {
      id: deviceId,
      ...(role !== "super_admin" ? { tenantId: tenantId as string } : {}),
    },
    select: { traccarId: true, name: true, vehiclePlate: true },
  });

  if (!device || !device.traccarId) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  try {
    const positions = await traccar.getRouteReport(
      device.traccarId,
      from,
      to
    );

    return NextResponse.json(
      positions.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed,
        course: p.course,
        fixTime: p.fixTime,
        attributes: {
          ignition: p.attributes?.ignition,
          motion: p.attributes?.motion,
          totalDistance: p.attributes?.totalDistance,
        },
      }))
    );
  } catch (err) {
    console.error("Failed to fetch position history:", err);
    return NextResponse.json(
      { error: "Failed to fetch position history" },
      { status: 500 }
    );
  }
}
