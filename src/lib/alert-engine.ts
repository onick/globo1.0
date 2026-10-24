// Alert engine: decides which alerts one new position raises for a device, given what the
// engine knew about that device before. Pure, so the live bridge and the tests run the
// same logic.

import { haversineKm } from "@/lib/history";
import { distanceToRingM, pointInPolygon, type LngLat } from "@/lib/geofences";

export type EngineGeofence =
  | { id: string; shape?: "circle"; latitude: number; longitude: number; radiusM: number }
  | { id: string; shape: "polygon"; polygon: LngLat[] };

// How far the position is from the geofence's edge, in meters: negative inside, positive
// outside, for circles and drawn polygons alike
export function edgeDistanceM(g: EngineGeofence, position: { latitude: number; longitude: number }): number {
  if (g.shape === "polygon") {
    const point: LngLat = [position.longitude, position.latitude];
    const d = distanceToRingM(point, g.polygon);
    return pointInPolygon(point, g.polygon) ? -d : d;
  }
  return haversineKm(position, g) * 1000 - g.radiusM;
}

export interface EnginePosition {
  time: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
}

// What the engine remembers per device between positions
export interface DeviceAlertState {
  lastFixTime: string;
  // Geofences the vehicle is inside
  inside: string[];
  // Geofences the engine has already seen for this device. A geofence created while the
  // vehicle is inside it starts as "inside" without an enter alert: it never crossed in.
  known: string[];
  speeding: boolean;
}

export interface EngineAlert {
  type: "geofence_enter" | "geofence_exit" | "overspeed";
  geofenceId: string | null;
  time: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  limitKmh: number | null;
}

// GPS jitter around a geofence edge would flap enter/exit: the vehicle enters at the
// edge but only exits once it is this far beyond it.
export const GEOFENCE_EXIT_MARGIN_M = 25;
// Same for speeding: a new overspeed alert needs the speed to drop this far below the
// limit first, so hovering around the limit raises one alert, not one per fix.
export const OVERSPEED_RESET_MARGIN_KMH = 5;

export function evaluatePosition(
  state: DeviceAlertState | null,
  position: EnginePosition,
  geofences: EngineGeofence[],
  limitKmh: number
): { state: DeviceAlertState; alerts: EngineAlert[]; skipped: boolean } {
  // Older or repeated fixes (Traccar can deliver out of order) would replay transitions
  if (state && new Date(position.time).getTime() <= new Date(state.lastFixTime).getTime()) {
    return { state, alerts: [], skipped: true };
  }

  const edgeM = (g: EngineGeofence) => edgeDistanceM(g, position);
  const alert = (type: EngineAlert["type"], geofenceId: string | null): EngineAlert => ({
    type,
    geofenceId,
    time: position.time,
    latitude: position.latitude,
    longitude: position.longitude,
    speedKmh: Math.round(position.speedKmh * 10) / 10,
    limitKmh: type === "overspeed" ? limitKmh : null,
  });

  // First position seen for the device: nothing to compare with, just record where it is
  if (!state) {
    return {
      state: {
        lastFixTime: position.time,
        inside: geofences.filter((g) => edgeM(g) <= 0).map((g) => g.id),
        known: geofences.map((g) => g.id),
        speeding: position.speedKmh > limitKmh,
      },
      alerts: [],
      skipped: false,
    };
  }

  const alerts: EngineAlert[] = [];
  const inside: string[] = [];

  for (const g of geofences) {
    const d = edgeM(g);
    const wasInside = state.inside.includes(g.id);
    const isNew = !state.known.includes(g.id);

    if (wasInside) {
      if (d <= GEOFENCE_EXIT_MARGIN_M) inside.push(g.id);
      else alerts.push(alert("geofence_exit", g.id));
    } else if (d <= 0) {
      inside.push(g.id);
      if (!isNew) alerts.push(alert("geofence_enter", g.id));
    }
  }

  let speeding = state.speeding;
  if (!speeding && position.speedKmh > limitKmh) {
    speeding = true;
    alerts.push(alert("overspeed", null));
  } else if (speeding && position.speedKmh <= limitKmh - OVERSPEED_RESET_MARGIN_KMH) {
    speeding = false;
  }

  return {
    // Deleted geofences drop out of inside/known because only current ones are kept
    state: { lastFixTime: position.time, inside, known: geofences.map((g) => g.id), speeding },
    alerts,
    skipped: false,
  };
}
