import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { traccar } from "@/lib/traccar";
import { call, seedTwoTenants, signInAs } from "./helpers";

import * as adminDevices from "@/app/api/admin/devices/route";
import * as adminDevice from "@/app/api/admin/devices/[id]/route";
import * as devices from "@/app/api/devices/route";

type World = Awaited<ReturnType<typeof seedTwoTenants>>;

let w: World;
beforeEach(async () => {
  w = await seedTwoTenants();
  await redis.del("traccar:last-positions");
  // a's tracker is connected now; b's reported once, a month ago
  vi.mocked(traccar.getDevices).mockResolvedValue([
    { id: w.a.device.traccarId!, name: "", uniqueId: w.a.device.imei, status: "online", lastUpdate: "2026-10-24T18:00:00Z", positionId: 1 },
    { id: w.b.device.traccarId!, name: "", uniqueId: w.b.device.imei, status: "offline", lastUpdate: "2026-10-24T18:00:00Z", positionId: 2 },
  ]);
  vi.mocked(traccar.getPositionsById).mockResolvedValue([
    { id: 1, deviceId: w.a.device.traccarId!, latitude: 18.48, longitude: -69.93, speed: 0, course: 0, fixTime: "2026-10-24T17:59:00Z", attributes: {} },
    { id: 2, deviceId: w.b.device.traccarId!, latitude: 18.5, longitude: -69.9, speed: 0, course: 0, fixTime: "2026-09-24T10:00:00Z", attributes: {} },
  ] as never);
});

describe("admin device list", () => {
  it("shows every client's devices with their connection and the clients", async () => {
    signInAs(w.superAdmin);
    const { status, body } = await call(adminDevices.GET);
    expect(status).toBe(200);
    expect(body.tenants.map((t: { id: string }) => t.id).sort()).toEqual([w.a.tenant.id, w.b.tenant.id].sort());
    const byId = Object.fromEntries(body.devices.map((d: { id: string }) => [d.id, d]));
    // The last report is the position's own time, not when Traccar received it
    expect(byId[w.a.device.id]).toMatchObject({ connection: "online", lastReport: "2026-10-24T17:59:00Z", tenant: { id: w.a.tenant.id } });
    expect(byId[w.b.device.id]).toMatchObject({ connection: "offline", lastReport: "2026-09-24T10:00:00Z", tenant: { id: w.b.tenant.id } });
    expect(body.stats).toMatchObject({ total: 2, online: 1, offline: 1, never: 0 });
  });

  it("is only for super admins", async () => {
    signInAs(w.a.admin);
    expect((await call(adminDevices.GET)).status).toBe(403);
  });
});

describe("adding a device from the admin panel", () => {
  it("registers it in Traccar under the chosen client", async () => {
    signInAs(w.superAdmin);
    const { status, body } = await call(devices.POST, {
      method: "POST",
      body: { name: "New truck", imei: "864872030478397", tenantId: w.b.tenant.id },
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ tenantId: w.b.tenant.id, imei: "864872030478397" });
    expect(body.traccarId).toEqual(expect.any(Number));
    expect(await redis.get(`device:tenant:${body.traccarId}`)).toBe(w.b.tenant.id);
  });

  it("refuses an IMEI that is already registered, before touching Traccar", async () => {
    signInAs(w.superAdmin);
    vi.mocked(traccar.createDevice).mockClear();
    const { status } = await call(devices.POST, { method: "POST", body: { name: "Dup", imei: w.a.device.imei, tenantId: w.b.tenant.id } });
    expect(status).toBe(409);
    expect(traccar.createDevice).not.toHaveBeenCalled();
  });

  it("refuses a client that doesn't exist", async () => {
    signInAs(w.superAdmin);
    const { status } = await call(devices.POST, { method: "POST", body: { name: "X", imei: "359000000000001", tenantId: "no-such-client" } });
    expect(status).toBe(400);
  });
});

describe("quick edit from the admin panel", () => {
  it("moves a vehicle to another client and its live positions with it", async () => {
    signInAs(w.superAdmin);
    const { status } = await call(adminDevice.PATCH, { method: "PATCH", params: { id: w.a.device.id }, body: { tenantId: w.b.tenant.id } });
    expect(status).toBe(200);
    expect((await db.device.findUnique({ where: { id: w.a.device.id } }))?.tenantId).toBe(w.b.tenant.id);
    expect(await redis.get(`device:tenant:${w.a.device.traccarId}`)).toBe(w.b.tenant.id);
  });

  it("sends IMEI changes to Replace IMEI, which keeps the history", async () => {
    signInAs(w.superAdmin);
    const { status, body } = await call(adminDevice.PATCH, { method: "PATCH", params: { id: w.a.device.id }, body: { imei: "359999999999999" } });
    expect(status).toBe(400);
    expect(body.error).toMatch(/Replace IMEI/);
    expect((await db.device.findUnique({ where: { id: w.a.device.id } }))?.imei).toBe(w.a.device.imei);
  });

  it("deletes the vehicle from Traccar too", async () => {
    signInAs(w.superAdmin);
    vi.mocked(traccar.deleteDevice).mockClear();
    const { status } = await call(adminDevice.DELETE, { method: "DELETE", params: { id: w.a.device.id } });
    expect(status).toBe(200);
    expect(traccar.deleteDevice).toHaveBeenCalledWith(w.a.device.traccarId);
    expect(await db.device.count({ where: { id: w.a.device.id } })).toBe(0);
  });
});
