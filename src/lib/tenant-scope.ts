import { NextResponse } from "next/server";

// Prisma filter for the records a signed-in user may see: every client's for super admins,
// their own client's otherwise. null for a user with no client, who may see none: never
// build `{ tenantId: user.tenantId }` directly, an undefined tenantId would match them all.
export function tenantScope(user: Record<string, unknown>): { tenantId?: string } | null {
  if (user.role === "super_admin") return {};
  return typeof user.tenantId === "string" && user.tenantId ? { tenantId: user.tenantId } : null;
}

export function noClientResponse() {
  return NextResponse.json({ error: "Your user has no company assigned" }, { status: 403 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Your role doesn't allow this" }, { status: 403 });
}
