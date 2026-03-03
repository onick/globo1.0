import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_SETTINGS = {
  // General - Platform Information
  platformName: "Globo GPS",
  supportEmail: "support@globo.app",
  defaultTimezone: "America/Mexico_City",
  // General - Tracking Defaults
  updateInterval: 30,
  dataRetention: 90,
  speedUnit: "km/h",
  // General - Map Configuration
  mapProvider: "maplibre",
  defaultMapLat: 19.4326,
  defaultMapLng: -99.1332,
  defaultZoom: 12,
  // Notifications - Email
  notifyNewTenant: true,
  notifyDeviceOffline: true,
  notifyPaymentFailed: true,
  notifySystemErrors: true,
  notifyWeeklyDigest: false,
  // Notifications - Alert Thresholds
  offlineThreshold: 15,
  speedLimitAlert: 120,
  geofenceAlertRadius: 500,
  // Security - Authentication
  sessionTimeout: 60,
  maxLoginAttempts: 5,
  passwordMinLength: 8,
  lockoutDuration: 30,
  requireTwoFactor: false,
  requirePasswordComplexity: true,
  // Security - Access Control
  allowSelfRegistration: true,
  defaultUserRole: "viewer",
  ipWhitelist: "",
  // API & Integrations
  apiKey: "",
  rateLimit: 100,
  webhookUrl: "",
  // Integrations status
  slackConnected: true,
  emailSmtpConnected: true,
  twilioConnected: false,
};

function requireSuperAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return false;
  }
  return true;
}

export async function GET() {
  const session = await auth();
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let record = await db.platformSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!record) {
    // Generate an API key on first access
    const initialSettings = {
      ...DEFAULT_SETTINGS,
      apiKey: generateApiKey(),
    };
    record = await db.platformSettings.create({
      data: { id: "singleton", settings: initialSettings },
    });
  }

  const settings = { ...DEFAULT_SETTINGS, ...(record.settings as Record<string, unknown>) };
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Merge with existing settings
  let record = await db.platformSettings.findUnique({
    where: { id: "singleton" },
  });

  const existing = record ? (record.settings as Record<string, unknown>) : DEFAULT_SETTINGS;
  const merged = { ...existing, ...body };

  record = await db.platformSettings.upsert({
    where: { id: "singleton" },
    update: { settings: merged },
    create: { id: "singleton", settings: merged },
  });

  return NextResponse.json(merged);
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [8, 4, 4, 4, 12];
  return "glb_" + segments.map((len) => {
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }).join("");
}
