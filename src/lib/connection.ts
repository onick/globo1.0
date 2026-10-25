// A tracker's connection as the admin lists show it. "online" is Traccar's own status (the
// tracker holds a connection now). The last report is the time of its last position, not
// Traccar's lastUpdate: a position imported from another platform arrives today but was
// taken when the tracker last reported there.
export type Connection = "online" | "offline" | "never";

export function connectionOf(
  traccarStatus: string | null | undefined,
  lastFixTime: string | null | undefined
): { connection: Connection; lastReport: string | null } {
  if (traccarStatus === "online") return { connection: "online", lastReport: lastFixTime ?? null };
  if (!lastFixTime) return { connection: "never", lastReport: null };
  return { connection: "offline", lastReport: lastFixTime };
}
