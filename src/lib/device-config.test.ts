import { describe, expect, it } from "vitest";
import { parseDeviceConfig } from "@/lib/device-config";

describe("parseDeviceConfig", () => {
  it("keeps only the fields sent, trimmed", () => {
    expect(parseDeviceConfig({ apn: " internet.claro ", name: "ignored" })).toEqual({ data: { apn: "internet.claro" } });
  });

  it("clears a field sent empty", () => {
    expect(parseDeviceConfig({ apnUser: "", simCarrier: null })).toEqual({ data: { apnUser: null, simCarrier: null } });
  });

  it("accepts a known model, carrier and phone number", () => {
    expect(parseDeviceConfig({ trackerModel: "concox-gt06n", simCarrier: "Claro", simNumber: "+1 809-672-8477" })).toEqual({
      data: { trackerModel: "concox-gt06n", simCarrier: "Claro", simNumber: "+1 809-672-8477" },
    });
  });

  it.each([
    [{ trackerModel: "nokia-3310" }, /model/],
    [{ simCarrier: "docomo" }, /carrier/],
    [{ simNumber: "call me" }, /phone/],
    [{ apn: 42 }, /text/],
    [{ apn: "x".repeat(101) }, /long/],
  ])("rejects %o", (body, message) => {
    const result = parseDeviceConfig(body as Record<string, unknown>);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(message);
  });
});
