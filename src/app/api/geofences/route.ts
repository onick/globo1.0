import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { forbiddenResponse, noClientResponse, tenantScope } from "@/lib/tenant-scope";
import { invalidateAlertCache } from "@/lib/alert-processor";
import { parseGeofenceShape } from "@/lib/geofences";
import { Prisma } from "@prisma/client";

// GET /api/geofences — geofences of the current tenant (all of them for super admins)
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = tenantScope(session.user as Record<string, unknown>);
  if (!where) return noClientResponse();
  const geofences = await db.geofence.findMany({
    where,
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(geofences);
}

// POST /api/geofences — circle: { name, latitude, longitude, radiusM }; drawn polygon:
// { name, shape: "polygon", polygon: [[lng, lat], …] }; tenantId too for super admins
export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (!can(role, "geofences:manage")) return forbiddenResponse();

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  // Super admins have no tenant of their own and must say which one
  const targetTenant = role === "super_admin" ? body.tenantId : tenantId;
  if (!targetTenant) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const shape = parseGeofenceShape(body);
  if ("error" in shape) return NextResponse.json({ error: shape.error }, { status: 400 });
  const { polygon, ...rest } = shape.data;

  const geofence = await db.geofence.create({
    data: { tenantId: targetTenant as string, name, ...rest, polygon: polygon ?? Prisma.DbNull },
  });
  invalidateAlertCache();

  return NextResponse.json(geofence, { status: 201 });
}
