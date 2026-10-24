import WebSocket from "ws";
import { redis, redisPub } from "./redis";
import { db } from "./db";
import { processAlerts } from "./alert-processor";

let traccarWs: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
// Alert batches run one after another so a device's state is never updated concurrently
let alertQueue: Promise<void> = Promise.resolve();

interface TraccarMessage {
  positions?: Array<{
    deviceId: number;
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    attributes: Record<string, unknown>;
    fixTime: string;
  }>;
}

// Build device-to-tenant mapping in Redis
async function syncDeviceTenantMap() {
  const devices = await db.device.findMany({
    where: { traccarId: { not: null } },
    select: { traccarId: true, tenantId: true },
  });

  const pipeline = redis.pipeline();
  for (const device of devices) {
    pipeline.set(`device:tenant:${device.traccarId}`, device.tenantId);
  }
  await pipeline.exec();
  console.log(`[WS] Synced ${devices.length} device-tenant mappings`);
}

function connect() {
  const wsUrl =
    process.env.TRACCAR_WS_URL || "ws://localhost:8082/api/socket";
  const apiUrl =
    process.env.TRACCAR_API_URL || "http://localhost:8082/api";

  // Authenticate first to get cookie
  fetch(`${apiUrl}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: process.env.TRACCAR_ADMIN_EMAIL || "",
      password: process.env.TRACCAR_ADMIN_PASSWORD || "",
    }),
  })
    .then((res) => {
      const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
      traccarWs = new WebSocket(wsUrl, { headers: { Cookie: cookie } });

      traccarWs.on("open", () => {
        console.log("[WS] Connected to Traccar");
        syncDeviceTenantMap();
      });

      traccarWs.on("message", async (data) => {
        try {
          const message: TraccarMessage = JSON.parse(data.toString());
          if (message.positions) {
            const positions = message.positions;
            await handlePositions(positions);
            alertQueue = alertQueue
              .then(() => processAlerts(positions))
              .catch((err) => console.error("[WS] Alert processing error:", err));
          }
        } catch (err) {
          console.error("[WS] Parse error:", err);
        }
      });

      traccarWs.on("close", () => {
        console.log(
          "[WS] Disconnected from Traccar. Reconnecting in 5s..."
        );
        reconnectTimer = setTimeout(connect, 5000);
      });

      traccarWs.on("error", (err) => {
        console.error("[WS] Error:", err.message);
      });
    })
    .catch((err) => {
      console.error("[WS] Auth error:", err.message);
      reconnectTimer = setTimeout(connect, 5000);
    });
}

async function handlePositions(
  positions: NonNullable<TraccarMessage["positions"]>
) {
  const pipeline = redis.pipeline();

  for (const pos of positions) {
    const posData = JSON.stringify({
      deviceId: pos.deviceId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      course: pos.course,
      fixTime: pos.fixTime,
      attributes: pos.attributes,
    });

    // Cache latest position (expires in 5 minutes)
    pipeline.set(`device:pos:${pos.deviceId}`, posData, "EX", 300);

    // Get tenant for this device and publish
    const tenantId = await redis.get(`device:tenant:${pos.deviceId}`);
    if (tenantId) {
      redisPub.publish(`tenant:${tenantId}`, posData);
    }
  }

  await pipeline.exec();
}

// Started once per server process from instrumentation.ts; the guard covers dev reloads
export function startTraccarBridge() {
  const g = globalThis as unknown as { traccarBridgeStarted?: boolean };
  if (g.traccarBridgeStarted) return;
  g.traccarBridgeStarted = true;
  connect();
}

export function stopTraccarBridge() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (traccarWs) traccarWs.close();
}
