import { vi } from "vitest";

// The signed-in user comes from signInAs() in helpers.ts
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// In-memory Redis with the few commands the routes use
vi.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  const redis = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    },
    mget: async (...keys: (string | string[])[]) => keys.flat().map((k) => store.get(k) ?? null),
    del: async (...keys: string[]) => keys.filter((k) => store.delete(k)).length,
    flushall: async () => {
      store.clear();
      return "OK";
    },
  };
  return { redis, redisPub: { publish: async () => 0 }, redisSub: {} };
});

// Traccar: no positions unless a test sets them; devices get fresh ids
vi.mock("@/lib/traccar", () => {
  let nextId = 9000;
  return {
    traccar: {
      getRoute: vi.fn(async () => []),
      getDevices: vi.fn(async () => []),
      getPositionsById: vi.fn(async () => []),
      getStops: vi.fn(async () => []),
      createDevice: vi.fn(async () => ({ id: nextId++ })),
      deleteDevice: vi.fn(async () => undefined),
      updateDeviceUniqueId: vi.fn(async (id: number, uniqueId: string) => ({ id, uniqueId })),
    },
  };
});

vi.mock("@/lib/alert-processor", () => ({ invalidateAlertCache: vi.fn() }));
