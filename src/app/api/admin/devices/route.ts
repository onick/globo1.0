import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";
import { lastKnownPositions } from "@/lib/last-positions";
import { connectionOf } from "@/lib/connection";
import { trackerModel } from "@/lib/trackers";

// GET /api/admin/devices — every client's devices with their tracker's connection, and the
// clients for the filter. New devices are added with POST /api/devices, which also
// registers them in Traccar.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [devices, tenants, traccarDevices, positions] = await Promise.all([
    db.device.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        imei: true,
        vehiclePlate: true,
        vehicleType: true,
        status: true,
        createdAt: true,
        traccarId: true,
        trackerModel: true,
        simNumber: true,
        simCarrier: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
    db.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    traccar.getDevices().catch((err) => {
      console.warn("Could not load devices from Traccar:", err);
      return [];
    }),
    lastKnownPositions(),
  ]);
  const traccarById = new Map(traccarDevices.map((d) => [d.id, d]));

  const rows = devices.map(({ traccarId, trackerModel: modelId, ...device }) => ({
    ...device,
    trackerModel: modelId,
    trackerModelName: trackerModel(modelId)?.name ?? null,
    ...connectionOf(
      traccarId ? traccarById.get(traccarId)?.status : null,
      traccarId ? positions.get(traccarId)?.fixTime : null
    ),
  }));

  const count = (connection: string) => rows.filter((d) => d.connection === connection).length;
  return NextResponse.json({
    devices: rows,
    tenants,
    stats: {
      total: rows.length,
      online: count("online"),
      offline: count("offline"),
      never: count("never"),
      disabled: rows.filter((d) => d.status === "disabled").length,
    },
  });
}
