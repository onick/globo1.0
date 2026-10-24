import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { can, type Action } from "@/lib/permissions";
import { call, seedTwoTenants, signInAs } from "./helpers";

import * as devices from "@/app/api/devices/route";
import * as device from "@/app/api/devices/[id]/route";
import * as alertsRead from "@/app/api/alerts/read/route";
import * as geofences from "@/app/api/geofences/route";
import * as geofence from "@/app/api/geofences/[id]/route";
import * as recipients from "@/app/api/notification-recipients/route";
import * as recipient from "@/app/api/notification-recipients/[id]/route";
import * as company from "@/app/api/settings/company/route";
import * as profile from "@/app/api/settings/profile/route";

type World = Awaited<ReturnType<typeof seedTwoTenants>>;

let w: World;
beforeEach(async () => {
  w = await seedTwoTenants();
});

// Every change a client user can ask for, on their own client's data
const CHANGES: [string, Action, () => Promise<{ status: number }>][] = [
  ["add a vehicle", "vehicles:create", () => call(devices.POST, { method: "POST", body: { name: "New", imei: "imei-new" } })],
  ["edit a vehicle", "vehicles:edit", () => call(device.PATCH, { method: "PATCH", params: { id: w.a.device.id }, body: { name: "Renamed" } })],
  ["delete a vehicle", "vehicles:delete", () => call(device.DELETE, { method: "DELETE", params: { id: w.a.device.id } })],
  [
    "add a geofence",
    "geofences:manage",
    () => call(geofences.POST, { method: "POST", body: { name: "New", latitude: 18.5, longitude: -69.9, radiusM: 100 } }),
  ],
  ["delete a geofence", "geofences:manage", () => call(geofence.DELETE, { method: "DELETE", params: { id: w.a.geofence.id } })],
  ["mark alerts read", "alerts:acknowledge", () => call(alertsRead.POST, { method: "POST", body: {} })],
  [
    "add a notification recipient",
    "notifications:manage",
    () => call(recipients.POST, { method: "POST", body: { channel: "email", address: "new@test.local", alertTypes: ["overspeed"] } }),
  ],
  [
    "change a notification recipient",
    "notifications:manage",
    () => call(recipient.PATCH, { method: "PATCH", params: { id: w.a.recipient.id }, body: { active: false } }),
  ],
  ["delete a notification recipient", "notifications:manage", () => call(recipient.DELETE, { method: "DELETE", params: { id: w.a.recipient.id } })],
  ["rename the company", "company:edit", () => call(company.PATCH, { method: "PATCH", body: { name: "Renamed" } })],
];

describe.each(["admin", "operator", "viewer"] as const)("%s", (role) => {
  beforeEach(() => signInAs(w.a[role]));

  it.each(CHANGES)(`%s`, async (_name, action, request) => {
    const { status } = await request();
    if (can(role, action)) expect(status).toBeLessThan(300);
    else expect(status).toBe(403);
  });

  it("can update their own profile", async () => {
    const { status } = await call(profile.PATCH, { method: "PATCH", body: { name: `New ${role} name` } });
    expect(status).toBe(200);
  });

  it("can read everything in their client", async () => {
    expect((await call(devices.GET)).status).toBe(200);
    expect((await call(geofences.GET)).status).toBe(200);
    expect((await call(recipients.GET)).status).toBe(200);
  });
});

describe("a refused change leaves the data untouched", () => {
  it("viewer deleting a vehicle", async () => {
    signInAs(w.a.viewer);
    await call(device.DELETE, { method: "DELETE", params: { id: w.a.device.id } });
    expect(await db.device.count({ where: { id: w.a.device.id } })).toBe(1);
  });

  it("operator deleting a vehicle", async () => {
    signInAs(w.a.operator);
    await call(device.DELETE, { method: "DELETE", params: { id: w.a.device.id } });
    expect(await db.device.count({ where: { id: w.a.device.id } })).toBe(1);
  });

  it("operator renaming the company", async () => {
    signInAs(w.a.operator);
    await call(company.PATCH, { method: "PATCH", body: { name: "Renamed" } });
    expect(await db.tenant.findUnique({ where: { id: w.a.tenant.id } })).toMatchObject({ name: w.a.tenant.name });
  });

  it("company settings tell the page who may edit them", async () => {
    signInAs(w.a.operator);
    expect((await call(company.GET)).body).toMatchObject({ canEdit: false });
    signInAs(w.a.admin);
    expect((await call(company.GET)).body).toMatchObject({ canEdit: true });
  });
});
