import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard-data";

// GET /api/dashboard/summary — the fleet dashboard for the current tenant (all tenants for
// super admins): live state, today and the last 7 days, top vehicles and today's alerts
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as Record<string, unknown>;
  try {
    return NextResponse.json(
      await loadDashboard({ tenantId: (tenantId as string) ?? null, role: role as string })
    );
  } catch (err) {
    console.error("Dashboard summary failed:", err);
    return NextResponse.json({ error: "Could not load the dashboard" }, { status: 502 });
  }
}
