import { describe, expect, it } from "vitest";
import { parseSpeedLimit } from "@/lib/speed-limit";

describe("parseSpeedLimit", () => {
  it("leaves the limit alone when not sent, and resets it with null", () => {
    expect(parseSpeedLimit(undefined)).toEqual({ value: undefined });
    expect(parseSpeedLimit(null)).toEqual({ value: null });
  });

  it("accepts whole km/h from 10 to 200", () => {
    expect(parseSpeedLimit(10)).toEqual({ value: 10 });
    expect(parseSpeedLimit(200)).toEqual({ value: 200 });
  });

  it.each([9, 201, 70.5, "70", Number.NaN])("rejects %p", (value) => {
    expect(parseSpeedLimit(value)).toHaveProperty("error");
  });
});
