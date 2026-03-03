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
  const { name, slug, status, maxDevices } = body as {
    name?: string;
    slug?: string;
    status?: string;
    maxDevices?: number;
  };

  if (slug) {
    const existing = await db.tenant.findFirst({
      where: { slug, id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
  }

  const tenant = await db.tenant.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(slug && { slug: slug.trim() }),
      ...(status && { status: status as "active" | "trial" | "suspended" }),
      ...(maxDevices !== undefined && { maxDevices }),
    },
    include: {
      _count: { select: { devices: true, users: true } },
      subscriptions: {
        where: { status: { in: ["active", "trialing"] } },
        include: { plan: { select: { name: true } } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(tenant);
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
  await db.tenant.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
