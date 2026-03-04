"use client";

import { useState, useEffect, useCallback } from "react";

export interface PositionAttributes {
  motion?: boolean;
  ignition?: boolean;
  batteryLevel?: number;
  totalDistance?: number; // km
  hours?: number; // engine hours in ms
  [key: string]: unknown;
}

export interface Position {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  fixTime: string;
  deviceName: string;
  vehiclePlate: string | null;
  globoDeviceId: string;
  attributes?: PositionAttributes;
}

export interface Device {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  traccarId: number | null;
  driverName: string | null;
  driverPhone: string | null;
}

export type DeviceTrackingStatus = "moving" | "stopped" | "idle" | "offline";

export interface TrackedDevice extends Device {
  trackingStatus: DeviceTrackingStatus;
  position: Position | null;
  lastUpdate: string | null;
}

function computeTrackingStatus(
  device: Device,
  position: Position | null
): DeviceTrackingStatus {
  if (!position) return "offline";

  const now = Date.now();
  const fixAge = now - new Date(position.fixTime).getTime();
  const FIVE_MINUTES = 5 * 60 * 1000;

  if (position.speed > 0) return "moving";
  if (fixAge < FIVE_MINUTES) return "stopped";
  return "idle";
}

export function usePositions() {
  const [positions, setPositions] = useState<Map<number, Position>>(new Map());
  const [devices, setDevices] = useState<Device[]>([]);

  const loadPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/positions");
      if (res.ok) {
        const data: Position[] = await res.json();
        const map = new Map<number, Position>();
        data.forEach((p) => map.set(p.deviceId, p));
        setPositions(map);
      }
    } catch (err) {
      console.error("Failed to load positions:", err);
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        setDevices(await res.json());
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    loadDevices();
    loadPositions();
    const interval = setInterval(loadPositions, 3000);
    return () => clearInterval(interval);
  }, [loadDevices, loadPositions]);

  // Build tracked devices: merge devices + positions
  const trackedDevices: TrackedDevice[] = devices.map((device) => {
    const position = device.traccarId
      ? positions.get(device.traccarId) ?? null
      : null;
    return {
      ...device,
      trackingStatus: computeTrackingStatus(device, position),
      position,
      lastUpdate: position?.fixTime ?? null,
    };
  });

  // Status counts
  const statusCounts = {
    moving: trackedDevices.filter((d) => d.trackingStatus === "moving").length,
    stopped: trackedDevices.filter((d) => d.trackingStatus === "stopped").length,
    idle: trackedDevices.filter((d) => d.trackingStatus === "idle").length,
    offline: trackedDevices.filter((d) => d.trackingStatus === "offline").length,
    total: trackedDevices.length,
  };

  return {
    positions: Array.from(positions.values()),
    devices: trackedDevices,
    statusCounts,
    refresh: loadPositions,
    refreshDevices: loadDevices,
  };
}
