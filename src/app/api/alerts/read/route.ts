import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { forbiddenResponse, noClientResponse, tenantScope } from "@/lib/tenant-scope";

// POST /api/alerts/read — { ids: string[] } marks those alerts read; {} marks all of them
export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can((session.user as Record<string, unknown>).role, "alerts:acknowledge")) return forbiddenResponse();
  const scope = tenantScope(session.user as Record<string, unknown>);
  if (!scope) return noClientResponse();
  const body = await request.json().catch(() => ({}));

  const where: Prisma.AlertWhereInput = { readAt: null, ...scope };
  if (body.ids !== undefined) {
    if (!Array.isArray(body.ids) || !body.ids.every((id: unknown) => typeof id === "string")) {
      return NextResponse.json({ error: "ids must be a list of alert ids" }, { status: 400 });
    }
    where.id = { in: body.ids };
  }

  const { count } = await db.alert.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ marked: count });
}
