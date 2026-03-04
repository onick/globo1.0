"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  usePositions,
  type TrackedDevice,
  type DeviceTrackingStatus,
} from "@/hooks/usePositions";
import {
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Navigation,
  Truck,
  MapPin,
  Crosshair,
  Map as MapIcon,
  Route,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { DeviceDetailPanel } from "./device-detail-panel";
import { SensorOverlay } from "./sensor-overlay";

/* ── constants ────────────────────────────────────────── */

const STATUS_COLORS: Record<DeviceTrackingStatus, string> = {
  moving: "#16A34A",
  stopped: "#F59E0B",
  idle: "#F97316",
  offline: "#94A3B8",
};

const STATUS_LABELS: Record<DeviceTrackingStatus, string> = {
  moving: "Moving",
  stopped: "Stopped",
  idle: "Idle",
  offline: "Offline",
};

const MAP_STYLES = {
  streets: {
    label: "Streets",
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  light: {
    label: "Light",
    url: "https://tiles.openfreemap.org/styles/positron",
  },
  dark: {
    label: "Dark",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

/* ── SVG marker helpers ───────────────────────────────── */

function createArrowSvg(color: string, course: number): string {
  return `<svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${course}deg)">
    <circle cx="17" cy="17" r="15" fill="${color}" fill-opacity="0.15"/>
    <path d="M17 5 L25 27 L17 21 L9 27 Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function createDotSvg(color: string): string {
  return `<svg width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="9" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2"/>
    <circle cx="11" cy="11" r="3.5" fill="${color}"/>
  </svg>`;
}

function createMarkerEl(color: string, course: number, isMoving: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;line-height:0;";
  el.innerHTML = isMoving ? createArrowSvg(color, course) : createDotSvg(color);
  return el;
}

function updateMarkerEl(el: HTMLElement, color: string, course: number, isMoving: boolean): void {
  el.innerHTML = isMoving ? createArrowSvg(color, course) : createDotSvg(color);
}

/* ── other helpers ────────────────────────────────────── */

function popupHtml(pos: {
  deviceName: string;
  vehiclePlate: string | null;
  speed: number;
  course: number;
  fixTime: string;
  latitude: number;
  longitude: number;
}) {
  const bearing = pos.course >= 0 ? bearingLabel(pos.course) : "";
  // Use cached address if available to avoid "Loading..." flash
  const cacheKey = `${pos.latitude.toFixed(4)},${pos.longitude.toFixed(4)}`;
  const cachedAddr = geocodeCache.get(cacheKey);
  const addrContent = cachedAddr
    ? `📍 ${cachedAddr}`
    : `<span style="color:#CBD5E1;">📍 Loading address...</span>`;

  return `
    <div style="font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:13px;line-height:1.6;min-width:160px;">
      <strong style="color:#0F172A;">${pos.deviceName}</strong>
      ${pos.vehiclePlate ? `<br/><span style="color:#64748B;">${pos.vehiclePlate}</span>` : ""}
      <br/>Speed: <b>${Math.round(pos.speed)} km/h</b>${bearing ? ` <span style="color:#94A3B8;">• ${bearing}</span>` : ""}
      <br/><span style="color:#94A3B8;font-size:11px;">${new Date(pos.fixTime).toLocaleTimeString()}</span>
      <div id="addr-${pos.deviceName.replace(/\s/g, "_")}" style="color:#64748B;font-size:11px;margin-top:2px;max-width:220px;">
        ${addrContent}
      </div>
    </div>
  `;
}

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

/* ── geocode helper (client-side, calls our API) ──────── */

const geocodeCache = new Map<string, string>();

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const { address } = await res.json();
      geocodeCache.set(key, address);
      return address;
    }
  } catch { /* ignore */ }
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/* ── main component ──────────────────────────────────── */

export function TrackingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Trail: accumulate last N positions per device for breadcrumb lines
  const trailsRef = useRef<Map<number, [number, number][]>>(new Map());
  const TRAIL_MAX_POINTS = 120; // ~4 min at 2s polling

  const { positions, devices, statusCounts } = usePositions();

  const [panelOpen, setPanelOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceTrackingStatus | "all">("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [followingDeviceId, setFollowingDeviceId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("streets");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [routeDeviceId, setRouteDeviceId] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null);
  const [sensorOverlayOpen, setSensorOverlayOpen] = useState(true);

  /* ── detail device (live-updated from devices array) ── */
  const detailDevice = useMemo(() => {
    if (!detailDeviceId) return null;
    return devices.find((d) => d.id === detailDeviceId) ?? null;
  }, [detailDeviceId, devices]);

  /* ── filtered device list ──────────────────────────── */
  const filteredDevices = useMemo(() => {
    let list = devices;

    if (statusFilter !== "all") {
      list = list.filter((d) => d.trackingStatus === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.imei.toLowerCase().includes(q) ||
          (d.vehiclePlate && d.vehiclePlate.toLowerCase().includes(q))
      );
    }

    const order: Record<DeviceTrackingStatus, number> = {
      moving: 0,
      stopped: 1,
      idle: 2,
      offline: 3,
    };
    list.sort((a, b) => order[a.trackingStatus] - order[b.trackingStatus]);

    return list;
  }, [devices, statusFilter, search]);

  /* ── initialize map ────────────────────────────────── */
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[mapStyle].url,
      center: [-69.94, 18.73],
      zoom: 9,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    // Stop following if user manually drags the map
    mapRef.current.on("dragstart", () => {
      setFollowingDeviceId(null);
    });

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
                  '<div style="font-family:system-ui;font-size:13px;"><strong>You are here</strong></div>'
                )
              )
              .addTo(mapRef.current!);
          }
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: 13,
            duration: 1500,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── change map style ───────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current) return;
    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();

    mapRef.current.once("style.load", () => {
      mapRef.current?.setCenter(currentCenter);
      mapRef.current?.setZoom(currentZoom);
    });
    mapRef.current.setStyle(MAP_STYLES[mapStyle].url);
  }, [mapStyle]);

  /* ── update markers ────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current) return;

    const currentDeviceIds = new Set(positions.map((p) => p.deviceId));

    // Remove markers for devices no longer in positions
    markersRef.current.forEach(({ marker }, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        marker.remove();
        markersRef.current.delete(deviceId);
      }
    });

    // Find the matching tracked device for each position
    const deviceMap = new Map(devices.map((d) => [d.traccarId, d]));

    positions.forEach((pos) => {
      const tracked = deviceMap.get(pos.deviceId);
      const status: DeviceTrackingStatus = tracked?.trackingStatus ?? (pos.speed > 0 ? "moving" : "stopped");
      const color = STATUS_COLORS[status];
      const isMoving = status === "moving";

      const existing = markersRef.current.get(pos.deviceId);
      if (existing) {
        existing.marker.setLngLat([pos.longitude, pos.latitude]);
        // Only update popup HTML when popup is closed to avoid resetting the loaded address
        const popup = existing.marker.getPopup();
        if (popup && !popup.isOpen()) {
          popup.setHTML(popupHtml(pos));
        }
        updateMarkerEl(existing.el, color, pos.course, isMoving);
      } else {
        const el = createMarkerEl(color, pos.course, isMoving);
        const popup = new maplibregl.Popup({ offset: 18, maxWidth: "260px" }).setHTML(
          popupHtml(pos)
        );

        // Lazy-load address when popup opens
        popup.on("open", () => {
          const addrId = `addr-${pos.deviceName.replace(/\s/g, "_")}`;
          reverseGeocode(pos.latitude, pos.longitude).then((address) => {
            const addrEl = document.getElementById(addrId);
            if (addrEl) addrEl.textContent = `📍 ${address}`;
          });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([pos.longitude, pos.latitude])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.set(pos.deviceId, { marker, el });
      }
    });
  }, [positions, devices]);

  /* ── real-time trails (breadcrumb lines like Uber) ─── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const deviceMap = new Map(devices.map((d) => [d.traccarId, d]));
    const activeTrailIds = new Set<number>();

    positions.forEach((pos) => {
      const tracked = deviceMap.get(pos.deviceId);
      if (!tracked) return;

      activeTrailIds.add(pos.deviceId);

      // Accumulate trail points
      let trail = trailsRef.current.get(pos.deviceId);
      if (!trail) {
        trail = [];
        trailsRef.current.set(pos.deviceId, trail);
      }

      const coord: [number, number] = [pos.longitude, pos.latitude];

      // Only add if position actually changed (avoid duplicate stationary points)
      const last = trail[trail.length - 1];
      if (!last || Math.abs(last[0] - coord[0]) > 0.00001 || Math.abs(last[1] - coord[1]) > 0.00001) {
        trail.push(coord);
        if (trail.length > TRAIL_MAX_POINTS) {
          trail.splice(0, trail.length - TRAIL_MAX_POINTS);
        }
      }

      // Only render trail if device has moved (at least 2 points)
      if (trail.length < 2) return;

      const sourceId = `trail-${pos.deviceId}`;
      const layerId = `trail-line-${pos.deviceId}`;
      const status = tracked.trackingStatus;
      const color = STATUS_COLORS[status];

      const geojsonData: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: trail },
      };

      try {
        const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (existingSource) {
          existingSource.setData(geojsonData);
        } else if (map.isStyleLoaded()) {
          map.addSource(sourceId, { type: "geojson", data: geojsonData });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": color,
              "line-width": 3,
              "line-opacity": 0.6,
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          });
        }
      } catch { /* style may not be ready */ }
    });

    // Clean up trails for devices no longer in positions
    trailsRef.current.forEach((_, deviceId) => {
      if (!activeTrailIds.has(deviceId)) {
        const sourceId = `trail-${deviceId}`;
        const layerId = `trail-line-${deviceId}`;
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch { /* ignore */ }
        trailsRef.current.delete(deviceId);
      }
    });
  }, [positions, devices]);

  /* ── follow mode: auto-center on followed device ───── */
  useEffect(() => {
    if (!followingDeviceId || !mapRef.current) return;

    const device = devices.find((d) => d.id === followingDeviceId);
    if (device?.position) {
      mapRef.current.easeTo({
        center: [device.position.longitude, device.position.latitude],
        duration: 800,
      });
    }
  }, [followingDeviceId, positions, devices]);

  /* ── resize map on panel toggle ────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 350);
    return () => clearTimeout(timer);
  }, [panelOpen]);

  /* ── route history ─────────────────────────────────── */
  const clearRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getLayer("route-line-shadow")) map.removeLayer("route-line-shadow");
      if (map.getSource("route-source")) map.removeSource("route-source");
    } catch { /* style may have changed */ }
    setRouteDeviceId(null);
  }, []);

  const loadRoute = useCallback(async (device: TrackedDevice) => {
    if (!mapRef.current || !device.id) return;

    clearRoute();
    setRouteDeviceId(device.id);
    setRouteLoading(true);

    try {
      const now = new Date();
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);

      const res = await fetch(
        `/api/positions/history?deviceId=${device.id}&from=${from.toISOString()}&to=${now.toISOString()}`
      );

      if (!res.ok) throw new Error("Failed to fetch route");

      const points: { latitude: number; longitude: number; speed: number }[] =
        await res.json();

      if (points.length < 2) {
        setRouteLoading(false);
        return;
      }

      const coordinates = points.map((p) => [p.longitude, p.latitude]);
      const map = mapRef.current!;

      const addRouteLayer = () => {
        try {
          if (map.getSource("route-source")) {
            (map.getSource("route-source") as maplibregl.GeoJSONSource).setData({
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            });
          } else {
            map.addSource("route-source", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates },
              },
            });

            map.addLayer({
              id: "route-line-shadow",
              type: "line",
              source: "route-source",
              paint: {
                "line-color": "#0F172A",
                "line-width": 6,
                "line-opacity": 0.1,
              },
            });

            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route-source",
              paint: {
                "line-color": "#2563EB",
                "line-width": 3,
                "line-opacity": 0.8,
              },
            });
          }

          // Fit bounds to show full route
          const bounds = new maplibregl.LngLatBounds();
          coordinates.forEach((c) => bounds.extend(c as [number, number]));
          map.fitBounds(bounds, { padding: 80, duration: 1000 });
        } catch (err) {
          console.error("Error adding route layer:", err);
        }
      };

      if (map.isStyleLoaded()) {
        addRouteLayer();
      } else {
        map.once("style.load", addRouteLayer);
      }
    } catch (err) {
      console.error("Route load error:", err);
    } finally {
      setRouteLoading(false);
    }
  }, [clearRoute]);

  // Clear route + trail layers when map style changes
  useEffect(() => {
    setRouteDeviceId(null);
    // Trails: sources/layers are removed by style change, but we keep the
    // accumulated points so trails rebuild quickly on next position tick.
    // Just need to clear the "source already exists" assumption.
    // The trail effect will re-add sources on next render.
  }, [mapStyle]);

  /* ── fly to device ─────────────────────────────────── */
  function handleDeviceClick(device: TrackedDevice) {
    setSelectedDeviceId(device.id);
    setDetailDeviceId(device.id);
    setSensorOverlayOpen(true);

    if (device.position && mapRef.current) {
      mapRef.current.flyTo({
        center: [device.position.longitude, device.position.latitude],
        zoom: 15,
        duration: 1000,
      });

      const marker = device.traccarId
        ? markersRef.current.get(device.traccarId)
        : null;
      if (marker) {
        marker.marker.togglePopup();
      }
    }
  }

  function handleFollowToggle(device: TrackedDevice) {
    if (followingDeviceId === device.id) {
      setFollowingDeviceId(null);
    } else {
      setFollowingDeviceId(device.id);
      setSelectedDeviceId(device.id);
      if (device.position && mapRef.current) {
        mapRef.current.flyTo({
          center: [device.position.longitude, device.position.latitude],
          zoom: 16,
          duration: 1000,
        });
      }
    }
  }

  function handleRouteToggle(device: TrackedDevice) {
    if (routeDeviceId === device.id) {
      clearRoute();
    } else {
      loadRoute(device);
    }
  }

  /* ── render ────────────────────────────────────────── */
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Map */}
      <div ref={mapContainer} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* ── Device Panel ── */}
      <div
        className={`absolute top-0 left-0 h-full z-10 flex transition-all duration-300 ease-in-out ${
          panelOpen ? "w-[400px]" : "w-0"
        }`}
      >
        {/* Panel content */}
        <div
          className={`h-full bg-white shadow-lg flex flex-col overflow-hidden transition-all duration-300 ${
            panelOpen ? "w-[400px] opacity-100" : "w-0 opacity-0"
          }`}
        >
          {/* ── Detail Panel (when a device is selected) ── */}
          {detailDevice ? (
            <DeviceDetailPanel
              device={detailDevice}
              isFollowing={followingDeviceId === detailDevice.id}
              isRouteShown={routeDeviceId === detailDevice.id}
              routeLoading={routeLoading && routeDeviceId === detailDevice.id}
              onBack={() => {
                setDetailDeviceId(null);
                setSelectedDeviceId(null);
              }}
              onFollowToggle={() => handleFollowToggle(detailDevice)}
              onRouteToggle={() => handleRouteToggle(detailDevice)}
            />
          ) : (
            <>
              {/* ── Header with status counts ── */}
              <div className="px-4 pt-4 pb-3 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-[14px] font-semibold text-[#0F172A]">
                    Devices
                  </span>
                  <span className="ml-auto text-[12px] text-[#94A3B8] font-medium">
                    {statusCounts.total} total
                  </span>
                </div>

                {/* Status badges */}
                <div className="flex gap-1.5 flex-wrap">
                  <StatusBadge
                    count={statusCounts.moving}
                    label="Moving"
                    color="#16A34A"
                    active={statusFilter === "moving"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "moving" ? "all" : "moving")
                    }
                  />
                  <StatusBadge
                    count={statusCounts.stopped}
                    label="Stopped"
                    color="#F59E0B"
                    active={statusFilter === "stopped"}
                    onClick={() =>
                      setStatusFilter(
                        statusFilter === "stopped" ? "all" : "stopped"
                      )
                    }
                  />
                  <StatusBadge
                    count={statusCounts.idle}
                    label="Idle"
                    color="#F97316"
                    active={statusFilter === "idle"}
                    onClick={() =>
                      setStatusFilter(statusFilter === "idle" ? "all" : "idle")
                    }
                  />
                  <StatusBadge
                    count={statusCounts.offline}
                    label="Offline"
                    color="#94A3B8"
                    active={statusFilter === "offline"}
                    onClick={() =>
                      setStatusFilter(
                        statusFilter === "offline" ? "all" : "offline"
                      )
                    }
                  />
                </div>

                {/* Search */}
                <div className="relative mt-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search by name, IMEI, plate..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] transition-colors"
                  />
                </div>
              </div>

              {/* ── Device List ── */}
              <div className="flex-1 overflow-y-auto">
                {filteredDevices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <Truck className="w-10 h-10 text-[#E2E8F0] mb-2" />
                    <p className="text-[13px] text-[#94A3B8]">
                      {search || statusFilter !== "all"
                        ? "No devices match your filter"
                        : "No devices found"}
                    </p>
                  </div>
                ) : (
                  filteredDevices.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      isSelected={selectedDeviceId === device.id}
                      onClick={() => handleDeviceClick(device)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Toggle Button — anchored to panel edge ── */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="absolute z-20 top-4 flex items-center justify-center w-7 h-7 bg-white rounded-full shadow-md border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-all duration-300"
        style={{ left: panelOpen ? 400 - 14 : 8 }}
        title={panelOpen ? "Collapse panel" : "Expand panel"}
      >
        {panelOpen ? (
          <PanelLeftClose className="w-3.5 h-3.5 text-[#64748B]" />
        ) : (
          <PanelLeftOpen className="w-3.5 h-3.5 text-[#64748B]" />
        )}
      </button>

      {/* ── Map Style Picker ── */}
      <div className="absolute z-20 bottom-6 right-3">
        <button
          onClick={() => setShowStylePicker(!showStylePicker)}
          className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-md border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
          title="Map style"
        >
          <MapIcon className="w-4 h-4 text-[#64748B]" />
        </button>

        {showStylePicker && (
          <div className="absolute bottom-10 right-0 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 min-w-[120px]">
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setMapStyle(key);
                  setShowStylePicker(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                  mapStyle === key
                    ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                    : "text-[#334155] hover:bg-[#F8FAFC]"
                }`}
              >
                {MAP_STYLES[key].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Following indicator ── */}
      {followingDeviceId && (
        <div className="absolute z-20 top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#2563EB] text-white px-3 py-1.5 rounded-full shadow-lg text-[12px] font-medium">
          <Crosshair className="w-3.5 h-3.5 animate-pulse" />
          Following {devices.find((d) => d.id === followingDeviceId)?.name || "device"}
          <button
            onClick={() => setFollowingDeviceId(null)}
            className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Route indicator ── */}
      {routeDeviceId && (
        <div className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white text-[#0F172A] px-3 py-1.5 rounded-full shadow-lg border border-[#E2E8F0] text-[12px] font-medium">
          <Route className="w-3.5 h-3.5 text-[#2563EB]" />
          Route: {devices.find((d) => d.id === routeDeviceId)?.name || "device"} (today)
          <button
            onClick={clearRoute}
            className="ml-1 hover:bg-[#F1F5F9] rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Sensor Overlay (floating on map) ── */}
      {sensorOverlayOpen &&
        detailDevice?.position?.attributes &&
        Object.keys(detailDevice.position.attributes).length > 0 && (
          <div className="absolute z-20 top-14 right-14 transition-all duration-200">
            <SensorOverlay
              attributes={detailDevice.position.attributes}
              speed={detailDevice.position.speed}
              onClose={() => setSensorOverlayOpen(false)}
            />
          </div>
        )}
    </div>
  );
}

/* ── StatusBadge ─────────────────────────────────────── */

function StatusBadge({
  count,
  label,
  color,
  active,
  onClick,
}: {
  count: number;
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
        active
          ? "ring-1 ring-offset-1"
          : "hover:bg-[#F8FAFC]"
      }`}
      style={{
        backgroundColor: active ? `${color}15` : undefined,
        color: active ? color : "#64748B",
        ringColor: active ? color : undefined,
        borderColor: active ? color : undefined,
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ── DeviceRow ───────────────────────────────────────── */

function DeviceRow({
  device,
  isSelected,
  onClick,
}: {
  device: TrackedDevice;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = STATUS_COLORS[device.trackingStatus];
  const label = STATUS_LABELS[device.trackingStatus];
  const hasPosition = !!device.position;

  return (
    <div
      className={`w-full border-b border-[#F8FAFC] transition-colors hover:bg-[#F8FAFC] ${
        isSelected ? "bg-[#EFF6FF]" : ""
      }`}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Status icon */}
        <div className="relative flex-shrink-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Truck className="w-4 h-4" style={{ color }} />
          </div>
          {device.trackingStatus === "moving" && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: color }}
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[#0F172A] truncate">
              {device.name}
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              {label}
            </span>
          </div>
          <span className="text-[12px] text-[#94A3B8] truncate block">
            {device.vehiclePlate || device.imei}
          </span>
        </div>

        {/* Right side: speed or last update */}
        <div className="flex-shrink-0 text-right mr-1">
          {hasPosition ? (
            <>
              <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums block">
                {Math.round(device.position!.speed)} km/h
              </span>
              <span className="text-[10px] text-[#94A3B8] block">
                {timeAgo(device.position!.fixTime)}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-[#94A3B8]">
              <MapPin className="w-3 h-3 inline-block mr-0.5 opacity-50" />
              No signal
            </span>
          )}
        </div>

        {/* Chevron hint */}
        <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] flex-shrink-0" />
      </button>
    </div>
  );
}
