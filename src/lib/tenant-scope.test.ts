import { describe, expect, it } from "vitest";
import { tenantScope } from "@/lib/tenant-scope";

describe("tenantScope", () => {
  it("lets super admins see every client", () => {
    expect(tenantScope({ role: "super_admin", tenantId: null })).toEqual({});
  });

  it("limits client users to their own client", () => {
    expect(tenantScope({ role: "viewer", tenantId: "t1" })).toEqual({ tenantId: "t1" });
  });

  it.each([null, undefined, ""])("gives users with no client nothing (tenantId %s)", (tenantId) => {
    expect(tenantScope({ role: "admin", tenantId })).toBeNull();
  });
});
