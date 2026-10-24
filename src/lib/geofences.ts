// Geofence limits and geometry shared by the API and the map

export const MIN_RADIUS_M = 30;
export const MAX_RADIUS_M = 50_000;

// Polygon approximating a circle, for drawing it on the map ([lon, lat] ring, closed)
export function circlePolygon(
  latitude: number,
  longitude: number,
  radiusM: number,
  steps = 64
): [number, number][] {
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos((latitude * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      longitude + (radiusM * Math.cos(angle)) / metersPerDegLon,
      latitude + (radiusM * Math.sin(angle)) / metersPerDegLat,
    ]);
  }
  return ring;
}
