// Fleet dashboard figures. Every number comes from the vehicles' positions and alerts:
// nothing here is estimated or sample data.

export interface DayActivity {
  distanceKm: number;
  drivingMin: number;
  trips: number;
  stops: number;
  maxSpeedKmh: number;
}

export interface VehicleDay extends DayActivity {
  id: string;
  name: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
}

export const EMPTY_DAY: DayActivity = { distanceKm: 0, drivingMin: 0, trips: 0, stops: 0, maxSpeedKmh: 0 };

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

// One vehicle's day from its trips and stops (same as the activity report computes them)
export function summarizeDay(
  trips: { distanceKm: number; durationMin: number; maxSpeedKmh: number }[],
  stopCount: number
): DayActivity {
  return {
    distanceKm: round(trips.reduce((sum, t) => sum + t.distanceKm, 0), 2),
    drivingMin: round(trips.reduce((sum, t) => sum + t.durationMin, 0), 1),
    trips: trips.length,
    stops: stopCount,
    maxSpeedKmh: trips.length ? Math.max(...trips.map((t) => t.maxSpeedKmh)) : 0,
  };
}

// The whole fleet's day
export function combineDays(days: DayActivity[]): DayActivity {
  return {
    distanceKm: round(days.reduce((sum, d) => sum + d.distanceKm, 0), 2),
    drivingMin: round(days.reduce((sum, d) => sum + d.drivingMin, 0), 1),
    trips: days.reduce((sum, d) => sum + d.trips, 0),
    stops: days.reduce((sum, d) => sum + d.stops, 0),
    maxSpeedKmh: days.reduce((max, d) => Math.max(max, d.maxSpeedKmh), 0),
  };
}

// Vehicles that drove the most, skipping those that didn't move
export function topVehicles(vehicles: VehicleDay[], count: number): VehicleDay[] {
  return vehicles
    .filter((v) => v.distanceKm > 0)
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, count);
}

// Change from one value to another, as a percentage; null when there's nothing to compare
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return round(((current - previous) / previous) * 100, 1);
}

// One-line summary of today built only from the figures above
export function describeDay(input: {
  movedVehicles: number;
  totalVehicles: number;
  today: DayActivity;
  speedingAlerts: number;
}): string {
  const { movedVehicles, totalVehicles, today, speedingAlerts } = input;
  if (totalVehicles === 0) return "No vehicles yet. Add your first device to start tracking.";
  if (movedVehicles === 0) return `None of your ${totalVehicles} vehicles has moved today.`;

  const hours = today.drivingMin / 60;
  const parts = [
    `${movedVehicles} of ${totalVehicles} vehicles moved today, covering ${today.distanceKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} km in ${hours.toLocaleString("en-US", { maximumFractionDigits: 1 })} h.`,
  ];
  parts.push(
    speedingAlerts === 0
      ? "No speeding alerts."
      : `${speedingAlerts} speeding alert${speedingAlerts === 1 ? "" : "s"}.`
  );
  return parts.join(" ");
}
