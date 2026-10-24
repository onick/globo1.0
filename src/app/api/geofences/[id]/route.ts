import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateAlertCache } from "@/lib/alert-processor";

// DELETE /api/geofences/:id — past alerts stay, without the geofence link
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const geofence = await db.geofence.findUnique({ where: { id } });
  if (!geofence) {
    return NextResponse.json({ error: "Geofence not found" }, { status: 404 });
  }
  if (role !== "super_admin" && geofence.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.geofence.delete({ where: { id } });
  invalidateAlertCache();

  return NextResponse.json({ message: "Geofence deleted" });
}
