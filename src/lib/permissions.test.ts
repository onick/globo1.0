import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, type Action } from "@/lib/permissions";

const ACTIONS = Object.keys(PERMISSIONS) as Action[];

describe("permissions", () => {
  it("lets admins and super admins do everything", () => {
    for (const action of ACTIONS) {
      expect(can("admin", action), action).toBe(true);
      expect(can("super_admin", action), action).toBe(true);
    }
  });

  it("keeps viewers read only", () => {
    for (const action of ACTIONS) expect(can("viewer", action), action).toBe(false);
  });

  it("lets operators work but not delete vehicles or change settings", () => {
    const allowed = ACTIONS.filter((a) => can("operator", a));
    expect(allowed).toEqual(["vehicles:create", "vehicles:edit", "geofences:manage", "alerts:acknowledge"]);
  });

  it("denies unknown or missing roles", () => {
    expect(can(undefined, "vehicles:edit")).toBe(false);
    expect(can("owner", "vehicles:edit")).toBe(false);
  });
});
