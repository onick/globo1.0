// Per-vehicle speed limit for overspeed alerts, as sent to the devices API.
// undefined: not sent (leave as is) · null: back to the default · 10–200 km/h otherwise
export function parseSpeedLimit(value: unknown): { error: string } | { value: number | null | undefined } {
  if (value === undefined || value === null) return { value };
  if (!Number.isInteger(value) || (value as number) < 10 || (value as number) > 200) {
    return { error: "speedLimitKmh must be a whole number between 10 and 200, or null" };
  }
  return { value: value as number };
}
