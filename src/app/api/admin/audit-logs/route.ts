import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as Record<string, unknown>;
  if (role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const total = await db.auditLog.count();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const today = await db.auditLog.count({
    where: { createdAt: { gte: dayAgo } },
  });

  const warnings = await db.auditLog.count({
    where: { level: "warning" },
  });

  const errors = await db.auditLog.count({
    where: { level: "error" },
  });

  const thisWeek = await db.auditLog.count({
    where: { createdAt: { gte: weekAgo } },
  });

  return NextResponse.json({
    logs,
    stats: { total, today, warnings, errors, thisWeek },
  });
}
