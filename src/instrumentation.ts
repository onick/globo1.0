// Runs once when the Next.js server starts
export async function register() {
  // The Traccar bridge feeds live positions (map) and the alert engine. Node runtime only;
  // TRACCAR_BRIDGE=off disables it, e.g. for processes that shouldn't open the connection.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.TRACCAR_BRIDGE === "off") return;
  const { startTraccarBridge } = await import("./lib/websocket");
  startTraccarBridge();
}
