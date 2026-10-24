import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { forbiddenResponse, noClientResponse, tenantScope } from "@/lib/tenant-scope";
import { invalidateAlertCache } from "@/lib/alert-processor";
import { MAX_RADIUS_M, MIN_RADIUS_M } from "@/lib/geofences";

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

// POST /api/geofences — { name, latitude, longitude, radiusM, tenantId (super admins only) }
export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (!can(role, "geofences:manage")) return forbiddenResponse();

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const { latitude, longitude, radiusM } = body;

  // Super admins have no tenant of their own and must say which one
  const targetTenant = role === "super_admin" ? body.tenantId : tenantId;
  if (!targetTenant) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (
    typeof latitude !== "number" || latitude < -90 || latitude > 90 ||
    typeof longitude !== "number" || longitude < -180 || longitude > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  if (!Number.isInteger(radiusM) || radiusM < MIN_RADIUS_M || radiusM > MAX_RADIUS_M) {
    return NextResponse.json(
      { error: `Radius must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} m` },
      { status: 400 }
    );
  }

  const geofence = await db.geofence.create({
    data: { tenantId: targetTenant as string, name, latitude, longitude, radiusM },
  });
  invalidateAlertCache();

  return NextResponse.json(geofence, { status: 201 });
}
