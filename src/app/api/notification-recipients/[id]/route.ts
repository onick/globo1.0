import { NextResponse } from "next/server";
import type { AlertType, NotificationRecipient } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateAlertTypes } from "@/lib/notify/validate";

async function findOwned(id: string): Promise<{ error: NextResponse } | { recipient: NotificationRecipient }> {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (role !== "admin" && role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const recipient = await db.notificationRecipient.findUnique({ where: { id } });
  if (!recipient) {
    return { error: NextResponse.json({ error: "Recipient not found" }, { status: 404 }) };
  }
  if (role !== "super_admin" && recipient.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { recipient };
}

// PATCH /api/notification-recipients/:id — { active?, alertTypes? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const found = await findOwned(id);
  if ("error" in found) return found.error;

  const body = await request.json();
  const data: { active?: boolean; alertTypes?: AlertType[] } = {};
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
    }
    data.active = body.active;
  }
  if (body.alertTypes !== undefined) {
    const types = validateAlertTypes(body.alertTypes);
    if ("error" in types) return NextResponse.json({ error: types.error }, { status: 400 });
    data.alertTypes = types.alertTypes as AlertType[];
  }

  const updated = await db.notificationRecipient.update({ where: { id }, data });
  return NextResponse.json(updated);
}

// DELETE /api/notification-recipients/:id — notifications already sent stay in the history
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const found = await findOwned(id);
  if ("error" in found) return found.error;

  await db.notificationRecipient.delete({ where: { id } });
  return NextResponse.json({ message: "Recipient deleted" });
}
