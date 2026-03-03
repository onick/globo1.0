import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session || (session.user as Record<string, unknown>).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [8, 4, 4, 4, 12];
  const apiKey = "glb_" + segments.map((len) => {
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }).join("");

  const record = await db.platformSettings.findUnique({
    where: { id: "singleton" },
  });

  const existing = record ? (record.settings as Record<string, unknown>) : {};
  const merged = { ...existing, apiKey };

  await db.platformSettings.upsert({
    where: { id: "singleton" },
    update: { settings: merged },
    create: { id: "singleton", settings: merged },
  });

  return NextResponse.json({ apiKey });
}
