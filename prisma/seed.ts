import { PrismaClient } from "../src/generated/prisma";
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

  console.log("Seed complete: 3 plans + super admin created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
