import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { call, seedTwoTenants, signInAs } from "./helpers";

import * as devices from "@/app/api/devices/route";
import * as device from "@/app/api/devices/[id]/route";
import * as positions from "@/app/api/positions/route";
import * as alerts from "@/app/api/alerts/route";
import * as alertsRead from "@/app/api/alerts/read/route";
import * as geofences from "@/app/api/geofences/route";
import * as geofence from "@/app/api/geofences/[id]/route";
import * as recipients from "@/app/api/notification-recipients/route";
import * as recipient from "@/app/api/notification-recipients/[id]/route";
import * as history from "@/app/api/history/route";
import * as activity from "@/app/api/reports/activity/route";
import * as dashboard from "@/app/api/dashboard/summary/route";
import * as company from "@/app/api/settings/company/route";
import * as adminTenants from "@/app/api/admin/tenants/route";
import * as adminTenant from "@/app/api/admin/tenants/[id]/route";
import * as adminUsers from "@/app/api/admin/users/route";
import * as adminDevices from "@/app/api/admin/devices/route";
import * as adminPlans from "@/app/api/admin/plans/route";
import * as adminAudit from "@/app/api/admin/audit-logs/route";
import * as adminSettings from "@/app/api/admin/settings/route";
import * as adminHealth from "@/app/api/admin/system-health/route";

type World = Awaited<ReturnType<typeof seedTwoTenants>>;
type Tenant = World["a"];

let w: World;

beforeEach(async () => {
  w = await seedTwoTenants();
  // Both vehicles are reporting right now
  for (const traccarId of [101, 201]) {
    await redis.set(`device:pos:${traccarId}`, JSON.stringify({ deviceId: traccarId, latitude: 18.48, longitude: -69.93, speed: 0 }));
  }
});

// Everything that identifies a client's data in a response
const fingerprints = (t: Tenant) => [
  t.tenant.id,
  t.tenant.name,
  t.device.id,
  t.device.name,
  t.geofence.id,
  t.alert.id,
  t.recipient.id,
  t.recipient.address,
];

function expectNoDataOf(body: unknown, t: Tenant) {
  const text = JSON.stringify(body);
  for (const value of fingerprints(t)) expect(text, `leaked ${value}`).not.toContain(value);
}

const today = () => {
  const to = new Date();
  return `from=${new Date(to.getTime() - 3600_000).toISOString()}&to=${to.toISOString()}`;
};

// Every endpoint that lists a client's data
const LISTS = [
  ["GET /api/devices", () => call(devices.GET, { path: "/api/devices" })],
  ["GET /api/positions", () => call(positions.GET, { path: "/api/positions" })],
  ["GET /api/alerts", () => call(alerts.GET, { path: "/api/alerts" })],
  ["GET /api/geofences", () => call(geofences.GET, { path: "/api/geofences" })],
  ["GET /api/notification-recipients", () => call(recipients.GET, { path: "/api/notification-recipients" })],
  ["GET /api/dashboard/summary", () => call(dashboard.GET, { path: "/api/dashboard/summary" })],
  ["GET /api/settings/company", () => call(company.GET, { path: "/api/settings/company" })],
] as const;

describe("a client's users only see their own client's data", () => {
  for (const role of ["admin", "operator", "viewer"] as const) {
    it.each(LISTS)(`${role}: %s`, async (_name, request) => {
      signInAs(w.a[role]);
      const { status, body } = await request();
      expect(status).toBe(200);
      expectNoDataOf(body, w.b);
    });
  }

  it("lists exactly the client's own records", async () => {
    signInAs(w.a.admin);
    const ids = async (request: () => Promise<{ body: { id: string }[] }>) => (await request()).body.map((r) => r.id);

    expect(await ids(() => call(devices.GET))).toEqual([w.a.device.id]);
    expect(await ids(() => call(alerts.GET, { path: "/api/alerts" }))).toEqual([w.a.alert.id]);
    expect(await ids(() => call(geofences.GET))).toEqual([w.a.geofence.id]);
    expect((await call(recipients.GET)).body.recipients.map((r: { id: string }) => r.id)).toEqual([w.a.recipient.id]);
    expect((await call(positions.GET)).body.map((p: { globoDeviceId: string }) => p.globoDeviceId)).toEqual([w.a.device.id]);
    expect((await call(alerts.GET, { path: "/api/alerts?count=unread" })).body).toEqual({ unread: 1 });
    expect((await call(company.GET)).body).toMatchObject({ id: w.a.tenant.id, _count: { devices: 1, users: 3 } });

    const summary = (await call(dashboard.GET)).body;
    expect(summary.vehicles).toMatchObject({ total: 1, reporting: 1 });
    expect(summary.alertsToday).toMatchObject({ total: 1, unread: 1 });
  });
});

describe("a client can't read another client's vehicle", () => {
  it.each([
    ["history", history.GET, "/api/history"],
    ["activity report", activity.GET, "/api/reports/activity"],
  ] as const)("%s", async (_name, handler, path) => {
    signInAs(w.a.admin);
    expect((await call(handler, { path: `${path}?deviceId=${w.a.device.id}&${today()}` })).status).toBe(200);

    const other = await call(handler, { path: `${path}?deviceId=${w.b.device.id}&${today()}` });
    expect(other.status).toBe(403);
    expectNoDataOf(other.body, w.b);
  });
});

describe("a client can't change another client's data", () => {
  beforeEach(() => signInAs(w.a.admin));

  it("vehicles", async () => {
    const params = { id: w.b.device.id };
    expect((await call(device.PATCH, { method: "PATCH", params, body: { name: "Hacked" } })).status).toBe(403);
    expect((await call(device.DELETE, { method: "DELETE", params })).status).toBe(403);
    expect(await db.device.findUnique({ where: { id: w.b.device.id } })).toMatchObject({ name: w.b.device.name });
  });

  it("geofences", async () => {
    expect((await call(geofence.DELETE, { method: "DELETE", params: { id: w.b.geofence.id } })).status).toBe(403);
    expect(await db.geofence.count({ where: { id: w.b.geofence.id } })).toBe(1);
  });

  it("notification recipients", async () => {
    const params = { id: w.b.recipient.id };
    expect((await call(recipient.PATCH, { method: "PATCH", params, body: { active: false } })).status).toBe(403);
    expect((await call(recipient.DELETE, { method: "DELETE", params })).status).toBe(403);
    expect(await db.notificationRecipient.findUnique({ where: { id: w.b.recipient.id } })).toMatchObject({ active: true });
  });

  it("alerts: marking read only touches the client's own alerts", async () => {
    const one = await call(alertsRead.POST, { method: "POST", body: { ids: [w.b.alert.id] } });
    expect(one.body).toEqual({ marked: 0 });
    const all = await call(alertsRead.POST, { method: "POST", body: {} });
    expect(all.body).toEqual({ marked: 1 });
    expect(await db.alert.findUnique({ where: { id: w.b.alert.id } })).toMatchObject({ readAt: null });
  });

  it("company settings only change the client's own company", async () => {
    expect((await call(company.PATCH, { method: "PATCH", body: { name: "Renamed" } })).status).toBe(200);
    expect(await db.tenant.findUnique({ where: { id: w.a.tenant.id } })).toMatchObject({ name: "Renamed" });
    expect(await db.tenant.findUnique({ where: { id: w.b.tenant.id } })).toMatchObject({ name: w.b.tenant.name });
  });
});

describe("a client can't create data in another client by naming it", () => {
  beforeEach(() => signInAs(w.a.admin));

  it.each([
    ["vehicle", () => call(devices.POST, { method: "POST", body: { name: "New", imei: "imei-new", tenantId: w.b.tenant.id } }), () => db.device.findUnique({ where: { imei: "imei-new" } })],
    [
      "geofence",
      () => call(geofences.POST, { method: "POST", body: { name: "New", latitude: 18.5, longitude: -69.9, radiusM: 100, tenantId: w.b.tenant.id } }),
      () => db.geofence.findFirst({ where: { name: "New" } }),
    ],
    [
      "recipient",
      () => call(recipients.POST, { method: "POST", body: { channel: "email", address: "new@test.local", alertTypes: ["overspeed"], tenantId: w.b.tenant.id } }),
      () => db.notificationRecipient.findFirst({ where: { address: "new@test.local" } }),
    ],
  ] as const)("%s", async (_name, create, find) => {
    expect((await create()).status).toBe(201);
    expect(await find()).toMatchObject({ tenantId: w.a.tenant.id });
  });
});

describe("client users can't use the platform admin", () => {
  it.each([
    ["GET /api/admin/tenants", () => call(adminTenants.GET)],
    ["GET /api/admin/users", () => call(adminUsers.GET)],
    ["GET /api/admin/devices", () => call(adminDevices.GET, { path: "/api/admin/devices" })],
    ["GET /api/admin/plans", () => call(adminPlans.GET)],
    ["GET /api/admin/audit-logs", () => call(adminAudit.GET, { path: "/api/admin/audit-logs" })],
    ["GET /api/admin/settings", () => call(adminSettings.GET)],
    ["GET /api/admin/system-health", () => call(adminHealth.GET)],
    ["PATCH /api/admin/tenants/:id", () => call(adminTenant.PATCH, { method: "PATCH", params: { id: w.b.tenant.id }, body: { name: "Mine" } })],
  ] as const)("%s", async (_name, request) => {
    signInAs(w.a.admin);
    const { status, body } = await request();
    expect(status).toBe(403);
    expectNoDataOf(body, w.b);
  });
});

describe("a user with no client sees no client's data", () => {
  beforeEach(() => signInAs(w.orphan));

  it.each(LISTS)("%s", async (_name, request) => {
    const { status, body } = await request();
    expect(status).toBeLessThan(500);
    expectNoDataOf(body, w.a);
    expectNoDataOf(body, w.b);
  });

  // A session without the field at all: Prisma ignores `tenantId: undefined` filters
  it.each(LISTS)("without tenantId in the session: %s", async (_name, request) => {
    const withoutTenant: Partial<typeof w.orphan> = { ...w.orphan };
    delete withoutTenant.tenantId;
    signInAs(withoutTenant as typeof w.orphan);
    const { body } = await request();
    expectNoDataOf(body, w.a);
    expectNoDataOf(body, w.b);
  });

  it("can't mark anyone's alerts read", async () => {
    await call(alertsRead.POST, { method: "POST", body: {} });
    expect(await db.alert.count({ where: { readAt: null } })).toBe(2);
  });

  it("can't create a vehicle in a client by naming it", async () => {
    await call(devices.POST, { method: "POST", body: { name: "New", imei: "imei-orphan", tenantId: w.b.tenant.id } });
    expect(await db.device.count({ where: { tenantId: w.b.tenant.id } })).toBe(1);
  });
});

describe("guards", () => {
  it.each(LISTS)("signed out: %s", async (_name, request) => {
    signInAs(null);
    expect((await request()).status).toBe(401);
  });

  // Without this the tests above could pass on endpoints that return nothing at all
  it("a super admin sees both clients", async () => {
    signInAs(w.superAdmin);
    const text = JSON.stringify((await call(devices.GET)).body);
    expect(text).toContain(w.a.device.id);
    expect(text).toContain(w.b.device.id);
  });
});
