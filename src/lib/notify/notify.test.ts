import { describe, expect, it } from "vitest";
import { buildAlertMessage, type AlertMessageInput } from "@/lib/notify/message";
import { afterFailure, MAX_ATTEMPTS } from "@/lib/notify/retry";
import { validateRecipient } from "@/lib/notify/validate";

const base: Omit<AlertMessageInput, "type"> = {
  time: new Date("2026-10-24T16:05:40Z"),
  speedKmh: 73.7,
  limitKmh: null,
  deviceName: "Camion alertas",
  vehiclePlate: "PRB-004",
  geofenceName: "Cliente intermedio",
  mapUrl: "https://app/map?history=1",
};

describe("buildAlertMessage", () => {
  it("writes geofence entries in Spanish, in Santo Domingo time (UTC-4)", () => {
    const m = buildAlertMessage({ ...base, type: "geofence_enter" });
    expect(m.subject).toBe("Camion alertas (PRB-004) entró en Cliente intermedio");
    expect(m.text).toMatch(/^Camion alertas \(PRB-004\) entró en Cliente intermedio\.\nFecha: 24\/10\/26,? 12:05:40\s?p\.\s?m\.\n/);
    expect(m.text).toContain("Ver en el mapa: https://app/map?history=1");
  });

  it("gives WhatsApp's template its 4 parameters", () => {
    const m = buildAlertMessage({ ...base, type: "geofence_enter" });
    expect(m.whatsappParams).toHaveLength(4);
    expect(m.whatsappParams[0]).toBe("Camion alertas (PRB-004)");
    expect(m.whatsappParams[3]).toBe("https://app/map?history=1");
  });

  it("names deleted geofences and vehicles without plate", () => {
    const m = buildAlertMessage({ ...base, type: "geofence_exit", geofenceName: null, vehiclePlate: null });
    expect(m.subject).toBe("Camion alertas salió de una geocerca eliminada");
  });

  it("states speed and limit for overspeed", () => {
    const m = buildAlertMessage({ ...base, type: "overspeed", limitKmh: 70, geofenceName: null });
    expect(m.subject).toBe("Exceso de velocidad: Camion alertas (PRB-004)");
    expect(m.whatsappParams[1]).toBe("iba a 74 km/h (límite 70 km/h)");
  });

  it("uses another time zone when configured", () => {
    expect(buildAlertMessage({ ...base, type: "geofence_enter" }, "UTC").text).toMatch(/Fecha: 24\/10\/26,? 4:05:40\s?p\.\s?m\./);
  });
});

describe("afterFailure", () => {
  const now = new Date("2026-10-24T12:00:00Z");

  it("retries after 30 s, 2, 10 and 30 min", () => {
    const waits = [1, 2, 3, 4].map((attempt) => {
      const next = afterFailure(attempt, now);
      return next.status === "pending" ? (next.nextAttemptAt.getTime() - now.getTime()) / 1000 : null;
    });
    expect(waits).toEqual([30, 120, 600, 1800]);
  });

  it("gives up on the 5th failure", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(afterFailure(5, now)).toEqual({ status: "failed" });
  });
});

describe("validateRecipient", () => {
  const types = ["overspeed"];

  it("normalizes email and WhatsApp addresses", () => {
    expect(validateRecipient({ channel: "email", address: " Ops@Flota.TEST ", alertTypes: types })).toMatchObject({ address: "ops@flota.test" });
    expect(validateRecipient({ channel: "whatsapp", address: "+1 (809) 555-1234", alertTypes: types })).toMatchObject({ address: "18095551234" });
  });

  it.each([
    [{ channel: "sms", address: "a@b.co", alertTypes: types }],
    [{ channel: "email", address: "not-an-email", alertTypes: types }],
    [{ channel: "whatsapp", address: "5551234", alertTypes: types }],
    [{ channel: "email", address: "a@b.co", alertTypes: [] }],
    [{ channel: "email", address: "a@b.co", alertTypes: ["unknown"] }],
  ])("rejects %j", (body) => {
    expect(validateRecipient(body)).toHaveProperty("error");
  });

  it("removes repeated alert types", () => {
    expect(validateRecipient({ channel: "email", address: "a@b.co", alertTypes: ["overspeed", "overspeed"] })).toMatchObject({ alertTypes: ["overspeed"] });
  });
});
