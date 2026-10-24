import { SIM_CARRIERS, trackerModel } from "@/lib/trackers";

export interface DeviceConfig {
  trackerModel?: string | null;
  simNumber?: string | null;
  simCarrier?: string | null;
  apn?: string | null;
  apnUser?: string | null;
  apnPassword?: string | null;
}

export const CONFIG_FIELDS = ["trackerModel", "simNumber", "simCarrier", "apn", "apnUser", "apnPassword"] as const;

// The tracker and SIM fields present in a request body, checked. Empty strings clear them.
export function parseDeviceConfig(body: Record<string, unknown>): { data: DeviceConfig } | { error: string } {
  const data: DeviceConfig = {};
  for (const field of CONFIG_FIELDS) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && typeof body[field] !== "string") return { error: `${field} must be text` };
    const value = ((body[field] as string | null) ?? "").trim();
    if (value.length > 100) return { error: `${field} is too long` };
    data[field] = value || null;
  }
  if (data.trackerModel && !trackerModel(data.trackerModel)) return { error: "Unknown tracker model" };
  if (data.simCarrier && !(SIM_CARRIERS as readonly string[]).includes(data.simCarrier)) {
    return { error: `SIM carrier must be one of ${SIM_CARRIERS.join(", ")}` };
  }
  if (data.simNumber && !/^\+?[0-9 ()-]{7,20}$/.test(data.simNumber)) {
    return { error: "The SIM number must be a phone number" };
  }
  return { data };
}
