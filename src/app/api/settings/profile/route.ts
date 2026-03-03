import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUserId(session: any): string | null {
  return session?.user?.id || null;
}

// GET /api/settings/profile
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getUserId(session);
  const email = session.user?.email;

  const user = await db.user.findFirst({
    where: userId ? { id: userId } : { email: email! },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(user);
}

// PATCH /api/settings/profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getUserId(session);
  const sessionEmail = session.user?.email;
  const body = await req.json();
  const { name, email } = body;

  if (!name?.trim() && !email?.trim()) {
    return NextResponse.json({ error: "Name or email required" }, { status: 400 });
  }

  // Find the user
  const user = await db.user.findFirst({
    where: userId ? { id: userId } : { email: sessionEmail! },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check email uniqueness if changing
  if (email && email !== user.email) {
    const existing = await db.user.findFirst({
      where: { email, id: { not: user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(email?.trim() && { email: email.trim().toLowerCase() }),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}
