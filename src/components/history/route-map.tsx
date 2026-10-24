"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "@/lib/map-style";
import type { RoutePoint, RouteStop } from "@/lib/history";

interface RouteMapProps {
  points: RoutePoint[];
  stops: RouteStop[];
  currentIndex: number;
}

function stopPopupHtml(stop: RouteStop) {
  return `
    <div style="font-family: sans-serif; font-size: 13px;">
      <strong>Stop · ${stop.durationMin} min</strong>
      <br/>${new Date(stop.startTime).toLocaleString()}
      ${stop.address ? `<br/><span style="color: #888;">${stop.address}</span>` : ""}
    </div>
  `;
}

export function RouteMap({ points, stops, currentIndex }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const overlayMarkersRef = useRef<maplibregl.Marker[]>([]);
  const vehicleRef = useRef<maplibregl.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: [-69.93, 18.48], // Default: Santo Domingo
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.8 },
      });
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Draw route, start/end and stops whenever a new history loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource("route") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: points.length
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: points.map((p) => [p.longitude, p.latitude]),
              },
            },
          ]
        : [],
    });

    overlayMarkersRef.current.forEach((m) => m.remove());
    overlayMarkersRef.current = [];
    if (!points.length) return;

    const first = points[0];
    const last = points[points.length - 1];
    overlayMarkersRef.current.push(
      new maplibregl.Marker({ color: "#16a34a" })
        .setLngLat([first.longitude, first.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText("Start"))
        .addTo(map),
      new maplibregl.Marker({ color: "#dc2626" })
        .setLngLat([last.longitude, last.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText("End"))
        .addTo(map)
    );

    stops.forEach((stop) => {
      const el = document.createElement("div");
      el.className =
        "h-5 w-5 rounded-full bg-amber-500 border-2 border-white shadow text-[10px] font-bold text-white flex items-center justify-center";
      el.textContent = "P";
      overlayMarkersRef.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(stopPopupHtml(stop)))
          .addTo(map)
      );
    });

    const bounds = new maplibregl.LngLatBounds();
    points.forEach((p) => bounds.extend([p.longitude, p.latitude]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
  }, [points, stops, mapReady]);

  // Move the vehicle marker during playback
  useEffect(() => {
    const map = mapRef.current;
    const point = points[currentIndex];
    if (!map || !point) {
      vehicleRef.current?.remove();
      vehicleRef.current = null;
      return;
    }

    const lngLat: [number, number] = [point.longitude, point.latitude];
    if (!vehicleRef.current) {
      const el = document.createElement("div");
      el.className = "h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow-lg";
      vehicleRef.current = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
    } else {
      vehicleRef.current.setLngLat(lngLat);
    }
  }, [points, currentIndex]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
