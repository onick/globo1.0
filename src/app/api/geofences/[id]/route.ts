import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { forbiddenResponse } from "@/lib/tenant-scope";
import { db } from "@/lib/db";
import { invalidateAlertCache } from "@/lib/alert-processor";
import { parseGeofenceShape } from "@/lib/geofences";
import { Prisma } from "@prisma/client";

// DELETE /api/geofences/:id — past alerts stay, without the geofence link
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (!can(role, "geofences:manage")) return forbiddenResponse();

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

// PATCH /api/geofences/:id — { name?, and the whole shape: a circle (latitude, longitude,
// radiusM) or { shape: "polygon", polygon } } — e.g. after moving its corners on the map
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (!can(role, "geofences:manage")) return forbiddenResponse();

  const { id } = await params;
  const geofence = await db.geofence.findUnique({ where: { id } });
  if (!geofence) {
    return NextResponse.json({ error: "Geofence not found" }, { status: 404 });
  }
  if (role !== "super_admin" && geofence.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === "") return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const shape = parseGeofenceShape(body);
  if ("error" in shape) return NextResponse.json({ error: shape.error }, { status: 400 });
  const { polygon, ...rest } = shape.data;

  const updated = await db.geofence.update({
    where: { id },
    data: { ...(name && { name }), ...rest, polygon: polygon ?? Prisma.DbNull },
  });
  invalidateAlertCache();
  return NextResponse.json(updated);
}
