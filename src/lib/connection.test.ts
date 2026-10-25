import { describe, expect, it } from "vitest";
import { connectionOf } from "@/lib/connection";

describe("connectionOf", () => {
  it("is online while Traccar says the tracker is connected", () => {
    expect(connectionOf("online", "2026-10-24T18:00:00Z")).toEqual({ connection: "online", lastReport: "2026-10-24T18:00:00Z" });
  });

  it("is offline with the time of its last position otherwise", () => {
    expect(connectionOf("offline", "2026-09-01T10:00:00Z")).toEqual({ connection: "offline", lastReport: "2026-09-01T10:00:00Z" });
    expect(connectionOf("unknown", "2026-09-01T10:00:00Z").connection).toBe("offline");
  });

  it("is never when the tracker has no position", () => {
    expect(connectionOf(undefined, null)).toEqual({ connection: "never", lastReport: null });
    expect(connectionOf("offline", undefined).connection).toBe("never");
  });
});
