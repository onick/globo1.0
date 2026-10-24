// Calendar days in a time zone. "Today" for a fleet in Santo Domingo starts at midnight
// there, not at midnight UTC.

export const DEFAULT_TIME_ZONE = "America/Santo_Domingo";

// "YYYY-MM-DD" of `date` in the zone
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Minutes the zone is ahead of UTC at `date` (Santo Domingo: -240)
function offsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

// UTC instants where the day starts and the next one starts, in the zone
export function dayBounds(key: string, timeZone: string): { from: Date; to: Date } {
  const [y, m, d] = key.split("-").map(Number);
  const startOf = (year: number, month: number, day: number) => {
    const guess = new Date(Date.UTC(year, month - 1, day));
    // Two passes settle the offset on days when it changes (daylight saving)
    let utc = guess.getTime() - offsetMinutes(guess, timeZone) * 60_000;
    utc = guess.getTime() - offsetMinutes(new Date(utc), timeZone) * 60_000;
    return new Date(utc);
  };
  return { from: startOf(y, m, d), to: startOf(y, m, d + 1) };
}

// The last `count` day keys ending with the day of `now`, oldest first
export function lastDays(now: Date, count: number, timeZone: string): string[] {
  const today = dayBounds(dayKey(now, timeZone), timeZone).from;
  return Array.from({ length: count }, (_, i) =>
    // noon of each previous day avoids landing on a daylight-saving boundary
    dayKey(new Date(today.getTime() - (count - 1 - i) * 86_400_000 + 12 * 3_600_000), timeZone)
  );
}
