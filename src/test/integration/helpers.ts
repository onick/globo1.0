import type { Mock } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface Actor {
  id: string;
  email: string;
  role: "super_admin" | "admin" | "operator" | "viewer";
  tenantId: string | null;
}

// The session every route will see from now on (null: signed out)
export function signInAs(actor: Actor | null) {
  (auth as unknown as Mock).mockResolvedValue(actor ? { user: actor, expires: "2099-01-01T00:00:00Z" } : null);
}

// Calls a route handler the way Next does and returns its status and JSON body
export async function call<P extends Record<string, string>>(
  handler: (request: NextRequest, context: { params: Promise<P> }) => Promise<Response>,
  { method = "GET", path = "/", body, params }: { method?: string; path?: string; body?: unknown; params?: P } = {}
) {
  const request = new NextRequest(`http://globo.test${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve(params ?? ({} as P)) });
  const json = await response.json().catch(() => null);
  return { status: response.status, body: json };
}

// Empties every table (the schema stays)
export async function wipeDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
}

// One client with everything a client can have
async function seedTenant(key: "a" | "b", traccarId: number) {
  const tenant = await db.tenant.create({
    data: { name: `Flota ${key.toUpperCase()}`, slug: `flota-${key}`, status: "active", maxDevices: 50 },
  });
  const user = (role: Actor["role"]) =>
    db.user.create({
      data: { email: `${role}-${key}@test.local`, password: "x", name: `${role} ${key}`, role, tenantId: tenant.id },
    });
  const [admin, operator, viewer] = await Promise.all([user("admin"), user("operator"), user("viewer")]);
  const device = await db.device.create({
    data: { tenantId: tenant.id, traccarId, name: `Camión ${key.toUpperCase()}`, imei: `imei-${key}`, vehiclePlate: `PLACA-${key}` },
  });
  const geofence = await db.geofence.create({
    data: { tenantId: tenant.id, name: `Depósito ${key.toUpperCase()}`, latitude: 18.48, longitude: -69.93, radiusM: 200 },
  });
  const alert = await db.alert.create({
    data: {
      tenantId: tenant.id,
      deviceId: device.id,
      type: "geofence_enter",
      geofenceId: geofence.id,
      time: new Date(),
      latitude: 18.48,
      longitude: -69.93,
      speedKmh: 20,
      dedupKey: `dedup-${key}`,
    },
  });
  const recipient = await db.notificationRecipient.create({
    data: { tenantId: tenant.id, channel: "email", address: `ops-${key}@test.local`, alertTypes: ["geofence_enter"] },
  });
  await db.notification.create({
    data: { alertId: alert.id, recipientId: recipient.id, channel: "email", address: recipient.address, status: "sent" },
  });

  const actor = (u: { id: string; email: string; role: Actor["role"] }): Actor => ({ id: u.id, email: u.email, role: u.role, tenantId: tenant.id });
  return {
    tenant,
    admin: actor(admin),
    operator: actor(operator),
    viewer: actor(viewer),
    device,
    geofence,
    alert,
    recipient,
  };
}

// Two clients, a super admin and a user that belongs to no client
export async function seedTwoTenants() {
  await wipeDatabase();
  const a = await seedTenant("a", 101);
  const b = await seedTenant("b", 201);
  const superAdmin = await db.user.create({
    data: { email: "super@test.local", password: "x", name: "Super", role: "super_admin" },
  });
  // Possible today: /admin/users lets a super admin create an admin with no client
  const orphan = await db.user.create({
    data: { email: "orphan@test.local", password: "x", name: "Orphan", role: "admin" },
  });
  const plain = (u: { id: string; email: string; role: Actor["role"] }): Actor => ({ id: u.id, email: u.email, role: u.role, tenantId: null });
  return { a, b, superAdmin: plain(superAdmin), orphan: plain(orphan) };
}
