import { describe, expect, it } from "vitest";
import { serverAddress, trackerHostKind, trackerModel, TRACKER_MODELS, validateImei, type TrackerConfig } from "@/lib/trackers";

const config: TrackerConfig = { host: "13.127.228.11", apn: "internet.claro", apnUser: null, apnPassword: null };
const texts = (id: string, c: TrackerConfig = config) => {
  const model = trackerModel(id)!;
  return model.commands(c, model.port).map((cmd) => cmd.text);
};

describe("tracker models", () => {
  it("send each protocol to the port Traccar listens on", () => {
    const ports = Object.fromEntries(TRACKER_MODELS.map((m) => [m.protocol, m.port]));
    expect(ports).toEqual({ gt06: 5023, gps103: 5001, teltonika: 5027, osmand: 5055 });
  });

  it("have unique ids", () => {
    expect(new Set(TRACKER_MODELS.map((m) => m.id)).size).toBe(TRACKER_MODELS.length);
  });

  it("show the server address the tracker must send to", () => {
    expect(serverAddress(trackerModel("concox-gt06n")!, "13.127.228.11")).toBe("13.127.228.11:5023 (TCP)");
    expect(serverAddress(trackerModel("concox-gt06n")!, null)).toBeNull();
  });
});

describe("Concox commands", () => {
  it("point the tracker at Globo by IP or by domain", () => {
    expect(texts("concox-gt06n")).toContain("SERVER,0,13.127.228.11,5023,0#");
    expect(texts("concox-gt06n", { ...config, host: "gps.globo.do" })).toContain("SERVER,1,gps.globo.do,5023,0#");
  });

  it("set the APN, with credentials when the carrier needs them", () => {
    expect(texts("concox-gt06e")).toContain("APN,internet.claro#");
    expect(texts("concox-gt06e", { ...config, apnUser: "claro", apnPassword: "claro" })).toContain("APN,internet.claro,claro,claro#");
  });
});

describe("Coban commands", () => {
  it("use the password and Coban's syntax", () => {
    expect(texts("coban-303")).toEqual(
      expect.arrayContaining(["apn123456 internet.claro", "adminip123456 13.127.228.11 5001", "gprs123456"])
    );
  });

  it("only add the APN user and password when there are any", () => {
    expect(texts("coban-303").some((t) => t.startsWith("apnuser"))).toBe(false);
    expect(texts("coban-303", { ...config, apnUser: "u", apnPassword: "p" })).toEqual(
      expect.arrayContaining(["apnuser123456 u", "apnpasswd123456 p"])
    );
  });
});

describe("Teltonika commands", () => {
  it("set APN and server in one SMS starting with two spaces", () => {
    expect(texts("teltonika-fmb")[0]).toBe("  setparam 2001:internet.claro;2002:;2003:;2004:13.127.228.11;2005:5027;2006:0");
  });
});

describe("missing settings", () => {
  it("leave a visible placeholder and flag the command", () => {
    const model = trackerModel("concox-gt06n")!;
    const commands = model.commands({ host: null, apn: null, apnUser: null, apnPassword: null }, model.port);
    expect(commands.find((c) => c.label === "Server")).toMatchObject({ text: "SERVER,0,<SERVER>,5023,0#", incomplete: true });
    expect(commands.find((c) => c.label === "APN")).toMatchObject({ text: "APN,<APN>#", incomplete: true });
    expect(commands.find((c) => c.label === "Check location")).toMatchObject({ incomplete: false });
  });
});

describe("validateImei", () => {
  it("accepts IMEIs and other tracker identifiers", () => {
    expect(validateImei(" 352312096734457 ")).toEqual({ imei: "352312096734457" });
    expect(validateImei("SIM001000000001")).toEqual({ imei: "SIM001000000001" });
    expect(validateImei("SIM-HIST-001")).toEqual({ imei: "SIM-HIST-001" });
  });

  it.each(["", "123", "35231 2096734457", null, "x".repeat(21)])("rejects %s", (value) => {
    expect(validateImei(value)).toHaveProperty("error");
  });
});

describe("trackerHostKind", () => {
  it.each([
    ["trackers.globo.do", "domain"],
    ["gps.example.com", "domain"],
    ["13.127.228.11", "ip"],
    ["300.1.1.1", "invalid"],
    ["localhost", "invalid"],
    ["globo .do", "invalid"],
    ["-bad.example.com", "invalid"],
  ])("%s is %s", (host, kind) => {
    expect(trackerHostKind(host)).toBe(kind);
  });

  it("is null when not configured", () => {
    expect(trackerHostKind(null)).toBeNull();
    expect(trackerHostKind("")).toBeNull();
  });
});
