import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create plans
  await prisma.plan.upsert({
    where: { name: "Basic" },
    update: {},
    create: {
      name: "Basic",
      maxDevices: 5,
      price: 999, // $9.99
      interval: "monthly",
      features: ["real-time tracking", "5 devices"],
    },
  });

  await prisma.plan.upsert({
    where: { name: "Pro" },
    update: {},
    create: {
      name: "Pro",
      maxDevices: 50,
      price: 4999, // $49.99
      interval: "monthly",
      features: [
        "real-time tracking",
        "50 devices",
        "geofences",
        "reports",
      ],
    },
  });

  await prisma.plan.upsert({
    where: { name: "Enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      maxDevices: 500,
      price: 19999, // $199.99
      interval: "monthly",
      features: [
        "real-time tracking",
        "500 devices",
        "geofences",
        "reports",
        "api access",
        "priority support",
      ],
    },
  });

  // Create super admin (no tenant)
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@globo.app" },
    update: {},
    create: {
      email: "admin@globo.app",
      password: hashedPassword,
      name: "Globo Admin",
      role: "super_admin",
      tenantId: null,
    },
  });

  // Seed audit logs with sample data matching the design
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    const now = new Date();
    const sampleLogs = [
      { userEmail: "admin@globo.app", action: "tenant.created", resource: "Tenant: Acme Logistics (acme-logistics)", level: "info" as const, ipAddress: "192.168.1.42", hoursAgo: 0.5 },
      { userEmail: "carlos@acme.com", action: "device.updated", resource: "Device: Truck 01 (status → inactive)", level: "info" as const, ipAddress: "10.0.0.115", hoursAgo: 1 },
      { userEmail: "admin@globo.app", action: "user.login_failed", resource: "Auth: 3 failed attempts from unknown IP", level: "warning" as const, ipAddress: "203.45.67.89", hoursAgo: 1.5 },
      { userEmail: "maria@fasttrack.io", action: "device.deleted", resource: "Device: Old Tracker #3 (permanently removed)", level: "error" as const, ipAddress: "172.16.0.88", hoursAgo: 2 },
      { userEmail: "admin@globo.app", action: "plan.updated", resource: "Plan: Pro (price $49.99 → $59.99)", level: "warning" as const, ipAddress: "192.168.1.42", hoursAgo: 13 },
      { userEmail: "jorge@green.co", action: "user.role_changed", resource: "User: Ana Lopez (operator → admin)", level: "info" as const, ipAddress: "10.0.2.201", hoursAgo: 14 },
      { userEmail: "admin@globo.app", action: "tenant.updated", resource: "Tenant: FastTrack Delivery (status → active)", level: "info" as const, ipAddress: "192.168.1.42", hoursAgo: 24 },
      { userEmail: "carlos@acme.com", action: "device.created", resource: "Device: Van Express 03 (IMEI: 861536030789012)", level: "info" as const, ipAddress: "10.0.0.115", hoursAgo: 25 },
      { userEmail: "admin@globo.app", action: "subscription.created", resource: "Subscription: Acme Logistics → Pro plan", level: "info" as const, ipAddress: "192.168.1.42", hoursAgo: 36 },
      { userEmail: "maria@fasttrack.io", action: "user.created", resource: "User: Pedro Sanchez (operator) for FastTrack", level: "info" as const, ipAddress: "172.16.0.88", hoursAgo: 48 },
      { userEmail: "admin@globo.app", action: "plan.created", resource: "Plan: Enterprise ($199.99/month)", level: "info" as const, ipAddress: "192.168.1.42", hoursAgo: 72 },
      { userEmail: "admin@globo.app", action: "system.backup", resource: "System: Database backup completed (2.3 GB)", level: "info" as const, ipAddress: "127.0.0.1", hoursAgo: 96 },
      { userEmail: "admin@globo.app", action: "tenant.suspended", resource: "Tenant: GreenFleet Co. (payment overdue 30d)", level: "error" as const, ipAddress: "192.168.1.42", hoursAgo: 120 },
      { userEmail: "jorge@green.co", action: "user.login_failed", resource: "Auth: Account locked after 5 attempts", level: "error" as const, ipAddress: "45.33.21.100", hoursAgo: 121 },
      { userEmail: "admin@globo.app", action: "device.bulk_import", resource: "Device: 15 devices imported for Metro Transport", level: "info" as const, ipAddress: "192.168.1.42", hoursAgo: 144 },
      { userEmail: "carlos@acme.com", action: "geofence.created", resource: "Geofence: Warehouse Zone A (Acme Logistics)", level: "info" as const, ipAddress: "10.0.0.115", hoursAgo: 168 },
      { userEmail: "admin@globo.app", action: "system.update", resource: "System: Platform updated to v2.4.0", level: "warning" as const, ipAddress: "127.0.0.1", hoursAgo: 200 },
      { userEmail: "maria@fasttrack.io", action: "device.updated", resource: "Device: Moto Courier 07 (plate MOT-9012 → MOT-9013)", level: "info" as const, ipAddress: "172.16.0.88", hoursAgo: 220 },
    ];

    await prisma.auditLog.createMany({
      data: sampleLogs.map((log) => ({
        userEmail: log.userEmail,
        action: log.action,
        resource: log.resource,
        level: log.level,
        ipAddress: log.ipAddress,
        createdAt: new Date(now.getTime() - log.hoursAgo * 60 * 60 * 1000),
      })),
    });

    console.log(`Seed: ${sampleLogs.length} audit log entries created`);
  }

  console.log("Seed complete: 3 plans + super admin + audit logs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
