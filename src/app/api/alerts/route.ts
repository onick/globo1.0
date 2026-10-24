import { NextResponse } from "next/server";
import type { AlertType, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { noClientResponse, tenantScope } from "@/lib/tenant-scope";

const TYPES: AlertType[] = ["geofence_enter", "geofence_exit", "overspeed"];
const MAX_LIMIT = 500;

// GET /api/alerts?unread=1&type=&from=&to=&limit=  — newest first
// GET /api/alerts?count=unread                      — { unread: n }, for the header bell
export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = tenantScope(session.user as Record<string, unknown>);
  if (!scope) return noClientResponse();
  const { searchParams } = new URL(request.url);

  const where: Prisma.AlertWhereInput = { ...scope };

  if (searchParams.get("count") === "unread") {
    const unread = await db.alert.count({ where: { ...where, readAt: null } });
    return NextResponse.json({ unread });
  }

  if (searchParams.get("unread") === "1") where.readAt = null;

  const type = searchParams.get("type");
  if (type) {
    if (!TYPES.includes(type as AlertType)) {
      return NextResponse.json({ error: "Unknown alert type" }, { status: 400 });
    }
    where.type = type as AlertType;
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    const range = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
    if ((range.gte && isNaN(range.gte.getTime())) || (range.lte && isNaN(range.lte.getTime()))) {
      return NextResponse.json({ error: "from and to must be valid dates" }, { status: 400 });
    }
    where.time = range;
  }

  const limit = Math.min(Number(searchParams.get("limit")) || 200, MAX_LIMIT);

  const alerts = await db.alert.findMany({
    where,
    orderBy: { time: "desc" },
    take: limit,
    include: {
      device: { select: { id: true, name: true, vehiclePlate: true } },
      geofence: { select: { id: true, name: true } },
      // Delivery status outside the app, so each alert shows whether it reached anyone
      notifications: {
        select: { channel: true, address: true, status: true, attempts: true, lastError: true, sentAt: true },
      },
    },
  });

  return NextResponse.json(alerts);
}
