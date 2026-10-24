// Queues notifications for new alerts and sends the pending ones, retrying failures.
import type { AlertType } from "@prisma/client";
import { db } from "@/lib/db";
import { buildAlertMessage } from "@/lib/notify/message";
import { sendEmail, sendWhatsApp } from "@/lib/notify/channels";
import { afterFailure } from "@/lib/notify/retry";

const TICK_MS = 5_000;
const BATCH = 25;
// Period shown around the alert when the map link is opened
const MAP_MARGIN_MS = 5 * 60_000;

// One pending notification per alert and matching active recipient of its tenant
export async function enqueueNotifications(alerts: { id: string; tenantId: string; type: AlertType }[]) {
  if (!alerts.length) return;
  const recipients = await db.notificationRecipient.findMany({
    where: { active: true, tenantId: { in: [...new Set(alerts.map((a) => a.tenantId))] } },
  });

  const rows = alerts.flatMap((alert) =>
    recipients
      .filter((r) => r.tenantId === alert.tenantId && r.alertTypes.includes(alert.type))
      .map((r) => ({ alertId: alert.id, recipientId: r.id, channel: r.channel, address: r.address }))
  );
  if (rows.length) await db.notification.createMany({ data: rows, skipDuplicates: true });
}

// Sends notifications that are due; returns how many were sent and how many failed
export async function dispatchDue(now = new Date()) {
  const due = await db.notification.findMany({
    where: { status: "pending", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH,
    include: {
      recipient: { select: { active: true } },
      alert: {
        include: {
          device: { select: { id: true, name: true, vehiclePlate: true } },
          geofence: { select: { name: true } },
        },
      },
    },
  });

  const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  let sent = 0;
  let failed = 0;

  for (const n of due) {
    // Recipient deleted or switched off after the alert was queued: don't keep trying
    if (!n.recipient?.active) {
      await db.notification.update({
        where: { id: n.id },
        data: { status: "failed", lastError: "Recipient removed or deactivated" },
      });
      failed++;
      continue;
    }

    const { alert } = n;
    const t = alert.time.getTime();
    const mapQuery = new URLSearchParams({
      deviceId: alert.device.id,
      from: new Date(t - MAP_MARGIN_MS).toISOString(),
      to: new Date(t + MAP_MARGIN_MS).toISOString(),
    });
    const message = buildAlertMessage(
      {
        type: alert.type,
        time: alert.time,
        speedKmh: alert.speedKmh,
        limitKmh: alert.limitKmh,
        deviceName: alert.device.name,
        vehiclePlate: alert.device.vehiclePlate,
        geofenceName: alert.geofence?.name ?? null,
        mapUrl: `${appUrl}/history?${mapQuery}`,
      },
      process.env.ALERT_TIMEZONE || undefined
    );

    const attempts = n.attempts + 1;
    try {
      if (n.channel === "email") await sendEmail(n.address, message);
      else await sendWhatsApp(n.address, message);
      await db.notification.update({
        where: { id: n.id },
        data: { status: "sent", sentAt: new Date(), attempts, lastError: null },
      });
      sent++;
    } catch (err) {
      const next = afterFailure(attempts, now);
      await db.notification.update({
        where: { id: n.id },
        data: {
          attempts,
          lastError: err instanceof Error ? err.message.slice(0, 500) : String(err),
          status: next.status,
          ...(next.status === "pending" ? { nextAttemptAt: next.nextAttemptAt } : {}),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}

// Started once per server process next to the Traccar bridge
export function startNotificationDispatcher() {
  const g = globalThis as unknown as { notificationDispatcherStarted?: boolean };
  if (g.notificationDispatcherStarted) return;
  g.notificationDispatcherStarted = true;

  let running = false;
  setInterval(async () => {
    if (running) return; // a slow send must not overlap the next tick
    running = true;
    try {
      await dispatchDue();
    } catch (err) {
      console.error("[notify] Dispatch error:", err);
    } finally {
      running = false;
    }
  }, TICK_MS);
}
