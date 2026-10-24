/**
 * First run on a new server: the plans and the platform's super admin. Unlike
 * prisma/seed.ts it adds no demo data and no default password. Safe to run again:
 * an existing admin keeps their password.
 *
 * Usage: BOOTSTRAP_ADMIN_EMAIL=… BOOTSTRAP_ADMIN_PASSWORD=… npx tsx scripts/bootstrap-prod.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const PLANS = [
  { name: "Basic", maxDevices: 5, price: 999, features: ["real-time tracking", "5 devices"] },
  { name: "Pro", maxDevices: 50, price: 4999, features: ["real-time tracking", "50 devices", "geofences", "reports"] },
  {
    name: "Enterprise",
    maxDevices: 500,
    price: 19999,
    features: ["real-time tracking", "500 devices", "geofences", "reports", "api access", "priority support"],
  },
];

const db = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (12+ characters)");
  }

  for (const plan of PLANS) {
    await db.plan.upsert({ where: { name: plan.name }, update: {}, create: { ...plan, interval: "monthly" } });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists (${existing.role}); password unchanged`);
  } else {
    await db.user.create({
      data: { email, password: await bcrypt.hash(password, 12), name: "Globo Admin", role: "super_admin", tenantId: null },
    });
    console.log(`Created super admin ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
