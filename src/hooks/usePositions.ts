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

async function fetchPositions(): Promise<Map<number, Position> | null> {
  try {
    const res = await fetch("/api/positions");
    if (!res.ok) return null;
    const data: Position[] = await res.json();
    return new Map(data.map((p) => [p.deviceId, p]));
  } catch (err) {
    console.error("Failed to load positions:", err);
    return null;
  }
}

async function fetchDevices(): Promise<Device[] | null> {
  try {
    const res = await fetch("/api/devices");
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error("Failed to load devices:", err);
    return null;
  }
}

export function usePositions() {
  const [positions, setPositions] = useState<Map<number, Position>>(new Map());
  const [devices, setDevices] = useState<Device[]>([]);

  // State is set from the requests' callbacks, never synchronously inside the effect
  useEffect(() => {
    let active = true;
    const refreshPositions = () =>
      fetchPositions().then((map) => {
        if (active && map) setPositions(map);
      });
    fetchDevices().then((list) => {
      if (active && list) setDevices(list);
    });
    refreshPositions();
    const interval = setInterval(refreshPositions, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const loadPositions = useCallback(async () => {
    const map = await fetchPositions();
    if (map) setPositions(map);
  }, []);

  const loadDevices = useCallback(async () => {
    const list = await fetchDevices();
    if (list) setDevices(list);
  }, []);

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
