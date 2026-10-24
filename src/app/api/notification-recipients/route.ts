import { NextResponse } from "next/server";
import type { AlertType, NotificationChannel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { noClientResponse, tenantScope } from "@/lib/tenant-scope";
import { emailConfigured, whatsappConfigured } from "@/lib/notify/channels";
import { validateRecipient } from "@/lib/notify/validate";

// GET /api/notification-recipients — recipients of the tenant and which channels the
// server can actually send through
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = tenantScope(session.user as Record<string, unknown>);
  if (!where) return noClientResponse();
  const recipients = await db.notificationRecipient.findMany({
    where,
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    recipients,
    channels: { email: emailConfigured(), whatsapp: whatsappConfigured() },
  });
}

// POST /api/notification-recipients — { channel, address, alertTypes, tenantId (super admins) }
export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const targetTenant = role === "super_admin" ? body.tenantId : tenantId;
  if (!targetTenant) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const checked = validateRecipient(body);
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const exists = await db.notificationRecipient.findUnique({
    where: {
      tenantId_channel_address: {
        tenantId: targetTenant as string,
        channel: checked.channel as NotificationChannel,
        address: checked.address,
      },
    },
  });
  if (exists) {
    return NextResponse.json({ error: "That recipient already exists" }, { status: 409 });
  }

  const recipient = await db.notificationRecipient.create({
    data: {
      tenantId: targetTenant as string,
      channel: checked.channel as NotificationChannel,
      address: checked.address,
      alertTypes: checked.alertTypes as AlertType[],
    },
  });
  return NextResponse.json(recipient, { status: 201 });
}
