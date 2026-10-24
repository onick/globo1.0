import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { can, type Action } from "@/lib/permissions";
import { call, seedTwoTenants, signInAs } from "./helpers";

import * as devices from "@/app/api/devices/route";
import * as device from "@/app/api/devices/[id]/route";
import * as deviceImei from "@/app/api/devices/[id]/imei/route";
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
  [
    "add a vehicle with its tracker and SIM",
    "vehicles:configure",
    () =>
      call(devices.POST, {
        method: "POST",
        body: { name: "New", imei: "imei-new-2", trackerModel: "concox-gt06e", simNumber: "8096728477", simCarrier: "Claro", apn: "internet" },
      }),
  ],
  ["edit a vehicle", "vehicles:edit", () => call(device.PATCH, { method: "PATCH", params: { id: w.a.device.id }, body: { name: "Renamed" } })],
  [
    "set the tracker model and SIM",
    "vehicles:configure",
    () => call(device.PATCH, { method: "PATCH", params: { id: w.a.device.id }, body: { trackerModel: "concox-gt06n", apn: "internet" } }),
  ],
  [
    "replace the tracker's IMEI",
    "vehicles:configure",
    () => call(deviceImei.POST, { method: "POST", params: { id: w.a.device.id }, body: { imei: "359999999999999", reason: "Broken" } }),
  ],
  ["delete a vehicle", "vehicles:delete", () => call(device.DELETE, { method: "DELETE", params: { id: w.a.device.id } })],
  [
    "add a geofence",
    "geofences:manage",
    () => call(geofences.POST, { method: "POST", body: { name: "New", latitude: 18.5, longitude: -69.9, radiusM: 100 } }),
  ],
  [
    "move a geofence",
    "geofences:manage",
    () => call(geofence.PATCH, { method: "PATCH", params: { id: w.a.geofence.id }, body: { latitude: 18.49, longitude: -69.92, radiusM: 300 } }),
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

describe("device detail", () => {
  beforeEach(async () => {
    await db.device.update({ where: { id: w.a.device.id }, data: { apn: "internet", apnPassword: "secret" } });
  });

  it("shows the APN password only to roles that configure trackers", async () => {
    signInAs(w.a.viewer);
    expect((await call(device.GET, { params: { id: w.a.device.id } })).body).toMatchObject({
      apn: "internet",
      apnPassword: null,
      permissions: { edit: false, configure: false, delete: false },
    });
    signInAs(w.a.admin);
    expect((await call(device.GET, { params: { id: w.a.device.id } })).body).toMatchObject({
      apnPassword: "secret",
      permissions: { edit: true, configure: true, delete: true },
    });
  });

  it("records an IMEI replacement and keeps the vehicle", async () => {
    signInAs(w.a.admin);
    await call(deviceImei.POST, { method: "POST", params: { id: w.a.device.id }, body: { imei: "359999999999999", reason: "Broken" } });
    const { body } = await call(device.GET, { params: { id: w.a.device.id } });
    expect(body).toMatchObject({ id: w.a.device.id, imei: "359999999999999" });
    expect(body.imeiChanges).toEqual([
      expect.objectContaining({ oldImei: w.a.device.imei, newImei: "359999999999999", reason: "Broken", changedBy: w.a.admin.email }),
    ]);
  });

  it("refuses an IMEI another vehicle already has", async () => {
    signInAs(w.a.admin);
    const { status } = await call(deviceImei.POST, { method: "POST", params: { id: w.a.device.id }, body: { imei: w.b.device.imei } });
    expect(status).toBe(409);
  });
});

describe("adding a vehicle with its tracker", () => {
  it("stores the model and SIM", async () => {
    signInAs(w.a.admin);
    const { status, body } = await call(devices.POST, {
      method: "POST",
      body: { name: "New", imei: "imei-new-3", trackerModel: "concox-gt06e", simNumber: "8096728477", simCarrier: "Claro" },
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ tenantId: w.a.tenant.id, trackerModel: "concox-gt06e", simNumber: "8096728477", simCarrier: "Claro" });
  });

  it("rejects an unknown model", async () => {
    signInAs(w.a.admin);
    const { status } = await call(devices.POST, { method: "POST", body: { name: "New", imei: "imei-new-4", trackerModel: "nokia" } });
    expect(status).toBe(400);
    expect(await db.device.count({ where: { imei: "imei-new-4" } })).toBe(0);
  });
});

describe("drawn geofences", () => {
  const square = [
    [-69.931, 18.48],
    [-69.929, 18.48],
    [-69.929, 18.482],
    [-69.931, 18.482],
  ];

  it("are stored with their shape, center and an enclosing radius", async () => {
    signInAs(w.a.operator);
    const { status, body } = await call(geofences.POST, {
      method: "POST",
      body: { name: "Yard", shape: "polygon", polygon: [...square, square[0]], tenantId: w.b.tenant.id },
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ tenantId: w.a.tenant.id, shape: "polygon", polygon: square, latitude: 18.481, longitude: -69.93 });
    expect(body.radiusM).toBeGreaterThan(150);
    const list = (await call(geofences.GET)).body as { name: string; shape: string }[];
    expect(list.find((g) => g.name === "Yard")).toMatchObject({ shape: "polygon" });
  });

  it("can be reshaped: a circle turned into a drawn area and back", async () => {
    signInAs(w.a.admin);
    const params = { id: w.a.geofence.id };
    const drawn = await call(geofence.PATCH, { method: "PATCH", params, body: { name: "Yard", shape: "polygon", polygon: square } });
    expect(drawn.status).toBe(200);
    expect(drawn.body).toMatchObject({ name: "Yard", shape: "polygon", polygon: square });
    const circle = await call(geofence.PATCH, { method: "PATCH", params, body: { latitude: 18.48, longitude: -69.93, radiusM: 120 } });
    expect(circle.body).toMatchObject({ name: "Yard", shape: "circle", radiusM: 120, polygon: null });
  });

  it("reject shapes that can't be watched", async () => {
    signInAs(w.a.admin);
    const bowTie = [square[0], square[2], square[1], square[3]];
    const { status, body } = await call(geofences.POST, { method: "POST", body: { name: "Bad", shape: "polygon", polygon: bowTie } });
    expect(status).toBe(400);
    expect(body.error).toMatch(/cross/);
    expect(await db.geofence.count({ where: { name: "Bad" } })).toBe(0);
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
