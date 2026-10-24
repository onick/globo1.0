// Validation of notification recipients, shared by create and update

export const CHANNELS = ["email", "whatsapp"] as const;
export const ALERT_TYPES = ["geofence_enter", "geofence_exit", "overspeed"] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// International format without "+" or spaces: country code + number (8 to 15 digits)
const WHATSAPP = /^[1-9]\d{7,14}$/;

export function validateAlertTypes(value: unknown): { error: string } | { alertTypes: string[] } {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((t) => (ALERT_TYPES as readonly string[]).includes(t))
  ) {
    return { error: `alertTypes must list at least one of: ${ALERT_TYPES.join(", ")}` };
  }
  return { alertTypes: [...new Set(value as string[])] };
}

export function validateRecipient(body: {
  channel?: unknown;
  address?: unknown;
  alertTypes?: unknown;
}): { error: string } | { channel: string; address: string; alertTypes: string[] } {
  if (!(CHANNELS as readonly unknown[]).includes(body.channel)) {
    return { error: "channel must be email or whatsapp" };
  }
  const channel = body.channel as string;
  const raw = typeof body.address === "string" ? body.address.trim() : "";
  // People type numbers with "+", spaces or dashes; store the digits only
  const address = channel === "whatsapp" ? raw.replace(/[\s()+-]/g, "") : raw.toLowerCase();

  if (channel === "email" && !EMAIL.test(address)) return { error: "Invalid email address" };
  if (channel === "whatsapp" && !WHATSAPP.test(address)) {
    return { error: "WhatsApp number must include the country code, e.g. 18095551234" };
  }

  const types = validateAlertTypes(body.alertTypes);
  if ("error" in types) return types;
  return { channel, address, alertTypes: types.alertTypes };
}
