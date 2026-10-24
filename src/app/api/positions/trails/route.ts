import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { liveTrails, TRAIL_MINUTES } from "@/lib/live-trails";
import { noClientResponse, tenantScope } from "@/lib/tenant-scope";

// GET /api/positions/trails — { minutes, trails: { [traccarId]: lines } }: the last minutes
// of each of the tenant's reporting vehicles, along the roads
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = tenantScope(session.user as Record<string, unknown>);
  if (!scope) return noClientResponse();

  const devices = await db.device.findMany({
    where: { ...scope, traccarId: { not: null } },
    select: { traccarId: true },
  });
  const trails = await liveTrails(devices.map((d) => d.traccarId!));
  return NextResponse.json({ minutes: TRAIL_MINUTES, trails });
}
