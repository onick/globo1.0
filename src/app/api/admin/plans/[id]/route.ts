import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, maxDevices, price, interval, features, active } = body as {
    name?: string;
    maxDevices?: number;
    price?: number;
    interval?: string;
    features?: string[];
    active?: boolean;
  };

  if (name) {
    const existing = await db.plan.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Plan name already exists" }, { status: 409 });
    }
  }

  const plan = await db.plan.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(maxDevices !== undefined && { maxDevices }),
      ...(price !== undefined && { price }),
      ...(interval && { interval }),
      ...(features !== undefined && { features }),
      ...(active !== undefined && { active }),
    },
    include: { _count: { select: { subscriptions: true } } },
  });

  return NextResponse.json(plan);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const subCount = await db.subscription.count({ where: { planId: id } });
  if (subCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete plan with active subscriptions" },
      { status: 409 }
    );
  }

  await db.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
