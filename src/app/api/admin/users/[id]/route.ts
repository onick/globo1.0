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
  const { name, email, role, tenantId } = body as {
    name?: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
  };

  if (email) {
    const existing = await db.user.findFirst({
      where: { email: email.trim().toLowerCase(), id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const user = await db.user.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(role && { role: role as "super_admin" | "admin" | "operator" | "viewer" }),
      ...(tenantId !== undefined && { tenantId: tenantId || null }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      tenant: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(user);
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
  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
