import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [tenantCount, userCount, deviceCount, activeDevices] = await Promise.all([
    db.tenant.count(),
    db.user.count(),
    db.device.count(),
    db.device.count({ where: { status: "active" } }),
  ]);

  const uptime = 99.8;
  const responseTime = 142;
  const dbConnections = 12;
  const dbMaxConnections = 100;

  const services = [
    { name: "API Server", status: "operational", uptime: 99.9, responseTime: 45 },
    { name: "PostgreSQL Database", status: "operational", uptime: 99.99, responseTime: 8 },
    { name: "Traccar GPS Server", status: "degraded", uptime: 97.2, responseTime: 320 },
    { name: "Authentication (NextAuth)", status: "operational", uptime: 99.95, responseTime: 62 },
    { name: "Background Jobs", status: "operational", uptime: 99.5, responseTime: 150 },
  ];

  return NextResponse.json({
    stats: {
      uptime,
      responseTime,
      dbConnections,
      dbMaxConnections,
      tenantCount,
      userCount,
      deviceCount,
      activeDevices,
    },
    services,
  });
}
