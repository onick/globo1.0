"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { usePositions } from "@/hooks/usePositions";

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

function createUserLocationEl() {
  const outer = document.createElement("div");
  outer.style.cssText =
    "width:20px;height:20px;border-radius:50%;background:rgba(59,130,246,0.2);display:flex;align-items:center;justify-content:center;";

  const inner = document.createElement("div");
  inner.style.cssText =
    "width:10px;height:10px;border-radius:50%;background:#3b82f6;border:2px solid #fff;box-shadow:0 0 4px rgba(59,130,246,0.5);";

  outer.appendChild(inner);
  return outer;
}

export function TrackingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const { positions } = usePositions();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [-69.94, 18.73],
      zoom: 9,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    // Geolocate user
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude, latitude } = pos.coords;

          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat([longitude, latitude]);
          } else {
            userMarkerRef.current = new maplibregl.Marker({
              element: createUserLocationEl(),
            })
              .setLngLat([longitude, latitude])
              .setPopup(
                new maplibregl.Popup({ offset: 12 }).setHTML(
                  '<div style="font-family:sans-serif;font-size:13px;"><strong>You are here</strong></div>'
                )
              )
              .addTo(mapRef.current!);
          }

          // Center map on user location
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: 13,
            duration: 1500,
          });
        },
        () => {
          // Permission denied or error — stay on default center
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // Update markers when positions change
  useEffect(() => {
    if (!mapRef.current) return;

    const currentDeviceIds = new Set(positions.map((p) => p.deviceId));

    markersRef.current.forEach((marker, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        marker.remove();
        markersRef.current.delete(deviceId);
      }
    });

    positions.forEach((pos) => {
      const existing = markersRef.current.get(pos.deviceId);

      if (existing) {
        existing.setLngLat([pos.longitude, pos.latitude]);
        existing.getPopup()?.setHTML(popupHtml(pos));
      } else {
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          popupHtml(pos)
        );

        const marker = new maplibregl.Marker({
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
    <div className="relative w-full h-full rounded-box overflow-hidden border border-base-content/5">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-3 left-3 bg-base-100/90 backdrop-blur-sm border border-base-content/10 px-3 py-2 rounded-btn flex items-center gap-2">
        <span className={`status ${positions.length > 0 ? "status-success animate-pulse" : "status-neutral"}`} />
        <span className="text-xs font-medium text-base-content/70 tabular-nums">
          {positions.length} device{positions.length !== 1 ? "s" : ""} online
        </span>
      </div>
    </div>
  );
}
