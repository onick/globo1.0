import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Simple in-memory cache for geocoding results (avoids Nominatim rate limits)
const cache = new Map<string, { address: string; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// GET /api/geocode?lat=X&lon=Y
export async function GET(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "Missing lat or lon parameters" },
      { status: 400 }
    );
  }

  // Round to ~11m precision for cache efficiency
  const cacheKey = `${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ address: cached.address });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Globo-GPS-Tracker/1.0",
          "Accept-Language": "es",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { address: `${lat}, ${lon}` },
        { status: 200 }
      );
    }

    const data = await res.json();
    const addr = data.address || {};

    // Build a concise address
    const parts: string[] = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts[parts.length - 1] += ` #${addr.house_number}`;
    if (addr.suburb || addr.neighbourhood)
      parts.push(addr.suburb || addr.neighbourhood);
    if (addr.city || addr.town || addr.village)
      parts.push(addr.city || addr.town || addr.village);

    const address = parts.length > 0 ? parts.join(", ") : data.display_name || `${lat}, ${lon}`;

    cache.set(cacheKey, { address, ts: Date.now() });

    return NextResponse.json({ address });
  } catch {
    return NextResponse.json({ address: `${lat}, ${lon}` });
  }
}
