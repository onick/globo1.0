import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { forbiddenResponse } from "@/lib/tenant-scope";
import { traccar } from "@/lib/traccar";
import { validateImei } from "@/lib/trackers";

// POST /api/devices/:id/imei — { imei, reason? }: a new tracker in the same vehicle. The
// vehicle keeps its positions, trips and alerts; the change is recorded.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role, email } = session.user as Record<string, unknown>;
  if (!can(role, "vehicles:configure")) return forbiddenResponse();
  const { id } = await params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device || (role !== "super_admin" && device.tenantId !== tenantId)) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const checked = validateImei(body.imei);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (checked.imei === device.imei) {
    return NextResponse.json({ error: "That is already this vehicle's IMEI" }, { status: 400 });
  }
  if (await db.device.findUnique({ where: { imei: checked.imei } })) {
    return NextResponse.json({ error: "Another vehicle already has that IMEI" }, { status: 409 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) || null : null;

  // Traccar first: if it refuses, nothing changes in Globo
  if (device.traccarId) {
    try {
      await traccar.updateDeviceUniqueId(device.traccarId, checked.imei);
    } catch (err) {
      console.error("Traccar refused the new IMEI:", err);
      return NextResponse.json({ error: "Could not change the IMEI in the tracking server" }, { status: 502 });
    }
  }

  const [updated] = await db.$transaction([
    db.device.update({ where: { id }, data: { imei: checked.imei } }),
    db.deviceImeiChange.create({
      data: {
        deviceId: id,
        oldImei: device.imei,
        newImei: checked.imei,
        reason,
        changedBy: typeof email === "string" ? email : "unknown",
      },
    }),
  ]);
  return NextResponse.json(updated);
}
