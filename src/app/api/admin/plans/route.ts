import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const plans = await db.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { price: "asc" },
  });

  const activeSubscriptions = await db.subscription.count({
    where: { status: { in: ["active", "trialing"] } },
  });

  const revenue = await db.subscription.findMany({
    where: { status: "active" },
    include: { plan: { select: { price: true } } },
  });
  const monthlyRevenue = revenue.reduce((sum, s) => sum + s.plan.price, 0);

  const tenantCount = await db.tenant.count();

  return NextResponse.json({
    plans,
    stats: {
      monthlyRevenue,
      activeSubscriptions,
      availablePlans: plans.filter((p) => p.active).length,
      avgRevenue: tenantCount > 0 ? Math.round(monthlyRevenue / tenantCount) : 0,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, maxDevices, price, interval, features, active } = body as {
    name?: string;
    maxDevices?: number;
    price?: number;
    interval?: string;
    features?: string[];
    active?: boolean;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await db.plan.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Plan name already exists" }, { status: 409 });
  }

  const plan = await db.plan.create({
    data: {
      name: name.trim(),
      maxDevices: maxDevices ?? 10,
      price: price ?? 0,
      interval: interval ?? "monthly",
      features: features ?? [],
      active: active ?? true,
    },
    include: { _count: { select: { subscriptions: true } } },
  });

  return NextResponse.json(plan, { status: 201 });
}
