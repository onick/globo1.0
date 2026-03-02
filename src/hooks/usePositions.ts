"use client";

import { useState, useEffect, useCallback } from "react";

interface Position {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  fixTime: string;
  deviceName: string;
  vehiclePlate: string | null;
  globoDeviceId: string;
}

export function usePositions() {
  const [positions, setPositions] = useState<Map<number, Position>>(new Map());

  // Load positions via REST
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

  // Poll every 3 seconds (upgrade to SSE/WebSocket later)
  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 3000);
    return () => clearInterval(interval);
  }, [loadPositions]);

  return {
    positions: Array.from(positions.values()),
    refresh: loadPositions,
  };
}
