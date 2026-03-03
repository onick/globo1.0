import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSessionData(session: any) {
  const user = session?.user || {};
  return {
    userId: user.id || null,
    email: user.email || null,
    tenantId: user.tenantId || null,
    role: user.role || null,
  };
}

// GET /api/settings/company
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let { tenantId, role } = getSessionData(session);

  // If no tenantId in session, look it up from the user record
  if (!tenantId) {
    const { userId, email } = getSessionData(session);
    const user = await db.user.findFirst({
      where: userId ? { id: userId } : { email: email! },
      select: { tenantId: true, role: true },
    });
    if (user) {
      tenantId = user.tenantId;
      role = role || user.role;
    }
  }

  if (!tenantId) {
    return NextResponse.json({ error: "No company assigned" }, { status: 404 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      maxDevices: true,
      createdAt: true,
      _count: { select: { devices: true, users: true } },
    },
  });

  if (!tenant) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  return NextResponse.json({ ...tenant, canEdit: role === "admin" || role === "super_admin" });
}

// PATCH /api/settings/company
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let { tenantId, role } = getSessionData(session);

  // If no tenantId in session, look it up
  if (!tenantId) {
    const { userId, email } = getSessionData(session);
    const user = await db.user.findFirst({
      where: userId ? { id: userId } : { email: email! },
      select: { tenantId: true, role: true },
    });
    if (user) {
      tenantId = user.tenantId;
      role = role || user.role;
    }
  }

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Only admins can update company settings" }, { status: 403 });
  }

  if (!tenantId) {
    return NextResponse.json({ error: "No company assigned" }, { status: 404 });
  }

  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Company name required" }, { status: 400 });
  }

  const updated = await db.tenant.update({
    where: { id: tenantId },
    data: { name: name.trim() },
    select: { id: true, name: true, slug: true, status: true, maxDevices: true },
  });

  return NextResponse.json(updated);
}
