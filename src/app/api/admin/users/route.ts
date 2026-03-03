import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      tenant: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.role === "admin" || u.role === "super_admin").length,
    operators: users.filter((u) => u.role === "operator").length,
    viewers: users.filter((u) => u.role === "viewer").length,
  };

  return NextResponse.json({ users, stats });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password, role, tenantId } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    tenantId?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required" },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email: email.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: (role as "super_admin" | "admin" | "operator" | "viewer") || "operator",
      tenantId: tenantId || null,
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

  return NextResponse.json(user, { status: 201 });
}
