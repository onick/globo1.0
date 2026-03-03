import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await db.tenant.findMany({
    include: {
      _count: { select: { devices: true, users: true } },
      subscriptions: {
        where: { status: { in: ["active", "trialing"] } },
        include: { plan: { select: { name: true } } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tenants);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, status, maxDevices } = body as {
    name?: string;
    slug?: string;
    status?: string;
    maxDevices?: number;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const finalSlug =
    slug?.trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const existing = await db.tenant.findUnique({ where: { slug: finalSlug } });
  if (existing) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const tenant = await db.tenant.create({
    data: {
      name: name.trim(),
      slug: finalSlug,
      status: (status as "active" | "trial" | "suspended") || "trial",
      maxDevices: maxDevices ?? 10,
    },
    include: {
      _count: { select: { devices: true, users: true } },
      subscriptions: {
        include: { plan: { select: { name: true } } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(tenant, { status: 201 });
}
