import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// GET /api/tracker-server — { host }: the public IP or domain trackers must send to (each
// tracker model adds its own port). null until TRACKER_SERVER_HOST is set.
export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ host: process.env.TRACKER_SERVER_HOST || null });
}
