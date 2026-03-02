"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePositions } from "@/hooks/usePositions";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface PositionData {
  deviceName: string;
  vehiclePlate: string | null;
  speed: number;
  fixTime: string;
}

function popupHtml(pos: PositionData) {
  return `
    <div style="font-family: sans-serif; font-size: 13px;">
      <strong>${pos.deviceName}</strong>
      ${pos.vehiclePlate ? `<br/>${pos.vehiclePlate}` : ""}
      <br/>Speed: ${Math.round(pos.speed)} km/h
      <br/><span style="color: #888;">${new Date(pos.fixTime).toLocaleTimeString()}</span>
    </div>
  `;
}

export function TrackingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const { positions } = usePositions();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-99.13, 19.43], // Default: Mexico City
      zoom: 12,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when positions change
  useEffect(() => {
    if (!mapRef.current) return;

    const currentDeviceIds = new Set(positions.map((p) => p.deviceId));

    // Remove markers for devices no longer in positions
    markersRef.current.forEach((marker, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        marker.remove();
        markersRef.current.delete(deviceId);
      }
    });

    // Add or update markers
    positions.forEach((pos) => {
      const existing = markersRef.current.get(pos.deviceId);

      if (existing) {
        existing.setLngLat([pos.longitude, pos.latitude]);
        existing.getPopup()?.setHTML(popupHtml(pos));
      } else {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          popupHtml(pos)
        );

        const marker = new mapboxgl.Marker({
          color: pos.speed > 0 ? "#22c55e" : "#a1a1aa",
        })
          .setLngLat([pos.longitude, pos.latitude])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.set(pos.deviceId, marker);
      }
    });
  }, [positions]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-md shadow text-sm">
        {positions.length} device{positions.length !== 1 ? "s" : ""} online
      </div>
    </div>
  );
}
