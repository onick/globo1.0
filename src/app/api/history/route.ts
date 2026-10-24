import { NextResponse } from "next/server";
import { summarizeRoute } from "@/lib/history";
import { loadDeviceHistory, snapToRoads } from "@/lib/device-history";

// GET /api/history?deviceId=<globo device id>&from=<ISO>&to=<ISO>
// Route, stops and summary for one device over a time range. With OSRM_URL set, the
// route is snapped to the roads; otherwise it is the line between GPS fixes.
export async function GET(request: Request) {
  const loaded = await loadDeviceHistory(request);
  if ("error" in loaded) return loaded.error;
  const { device, from, to, points, stops } = loaded.history;

  const matched = await snapToRoads(points);
  matched?.snapped.forEach((location, i) => {
    points[i].snapped = location;
  });

  return NextResponse.json({
    device,
    from: from.toISOString(),
    to: to.toISOString(),
    points,
    stops,
    route: matched ? { snappedToRoads: true, segments: matched.segments } : null,
    summary: summarizeRoute(points, matched ? matched.distanceKm : null),
  });
}
