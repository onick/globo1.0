"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useSearchParams } from "next/navigation";
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
  ChevronRight,
  History,
} from "lucide-react";
import { DeviceDetailPanel } from "./device-detail-panel";
import { SensorOverlay } from "./sensor-overlay";
import { HistoryPanel } from "./history-panel";
import { PlaybackControls } from "./playback-controls";
import { useRouteHistory, type StopEvent, type RouteSegment } from "@/hooks/useRouteHistory";
import { advanceTime, positionAt, stepTo } from "@/lib/playback";
import { vehicleIcon } from "@/lib/vehicle-icons";
import { VehicleIcon } from "@/components/shared/vehicle-icon";

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

// How often the live trails along the roads are reloaded
const TRAIL_REFRESH_MS = 10_000;

/* ── SVG marker helpers ───────────────────────────────── */

function createArrowSvg(color: string, course: number): string {
  return `<svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${course}deg)">
    <circle cx="17" cy="17" r="15" fill="${color}" fill-opacity="0.15"/>
    <path d="M17 5 L25 27 L17 21 L9 27 Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

// White vehicle icon (truck, motorbike, car…) as SVG markup, made once per type
const vehicleIconMarkup = new Map<string, string>();
function vehicleIconSvg(type: string | null): string {
  const key = type ?? "";
  let markup = vehicleIconMarkup.get(key);
  if (!markup) {
    markup = renderToStaticMarkup(createElement(vehicleIcon(type), { size: 15, color: "#fff", strokeWidth: 2.25 }));
    vehicleIconMarkup.set(key, markup);
  }
  return markup;
}

// Live vehicle: a circle in its status color with its type's icon, and a pointer showing
// its heading while it moves
function vehicleMarkerHtml(color: string, course: number, isMoving: boolean, type: string | null): string {
  const pointer = isMoving
    ? `<svg width="34" height="34" viewBox="0 0 34 34" style="position:absolute;inset:0;transform:rotate(${course}deg)">
        <path d="M17 0.5 L22.5 8 L11.5 8 Z" fill="${color}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>`
    : "";
  return `<div style="position:relative;width:34px;height:34px">
    ${pointer}
    <div style="position:absolute;left:5px;top:5px;width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center">
      ${vehicleIconSvg(type)}
    </div>
  </div>`;
}

function createMarkerEl(color: string, course: number, isMoving: boolean, type: string | null): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;line-height:0;";
  el.innerHTML = vehicleMarkerHtml(color, course, isMoving, type);
  return el;
}

function updateMarkerEl(el: HTMLElement, color: string, course: number, isMoving: boolean, type: string | null): void {
  el.innerHTML = vehicleMarkerHtml(color, course, isMoving, type);
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

  // Traccar ids of the live trails drawn on the map
  const trailIdsRef = useRef<Set<number>>(new Set());

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

  /* ── History mode state ────────────────────────────── */
  const [mapMode, setMapMode] = useState<"live" | "history">("live");
  const [historyDeviceId, setHistoryDeviceId] = useState<string | null>(null);
  const routeHistory = useRouteHistory();

  // Playback state: a clock in the trip's own time (ms), null before it starts
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);
  // The animation reads and moves the clock every frame; the state above follows it ~10 times a second
  const playbackTimeRef = useRef<number | null>(null);
  const playbackMarkerRef = useRef<maplibregl.Marker | null>(null);
  const historyMarkersRef = useRef<maplibregl.Marker[]>([]);
  const animFrameRef = useRef<number | null>(null);

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
          // Opened on a history period (report/alert link): keep the map on that route
          if (new URLSearchParams(window.location.search).get("history") === "1") return;
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
  // The map is created with the initial style: re-applying it on mount reloaded the style,
  // which reset the view and dropped layers drawn in between (e.g. a linked history)
  const appliedStyleRef = useRef(mapStyle);
  useEffect(() => {
    if (!mapRef.current || appliedStyleRef.current === mapStyle) return;
    appliedStyleRef.current = mapStyle;
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
        updateMarkerEl(existing.el, color, pos.course, isMoving, tracked?.vehicleType ?? null);
      } else {
        const el = createMarkerEl(color, pos.course, isMoving, tracked?.vehicleType ?? null);
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

  // History shows only the replayed vehicle: hundreds of live markers would bury its route
  useEffect(() => {
    const hidden = mapMode === "history";
    markersRef.current.forEach(({ el }) => {
      el.style.display = hidden ? "none" : "";
    });
  }, [mapMode, positions, devices]);

  /* ── live trails: each reporting vehicle's last minutes, along the roads ── */
  // Matched to the streets on the server (/api/positions/trails): joining the live
  // positions with straight lines would cut through the blocks between reports
  const [trails, setTrails] = useState<Record<number, [number, number][][]>>({});
  useEffect(() => {
    if (mapMode !== "live") return;
    let active = true;
    const load = () =>
      fetch("/api/positions/trails")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { trails: Record<number, [number, number][][]> } | null) => {
          if (active && data) setTrails(data.trails);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, TRAIL_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const deviceMap = new Map(devices.map((d) => [d.traccarId, d]));
    const shown = mapMode === "live" ? trails : {};

    Object.entries(shown).forEach(([key, lines]) => {
      const traccarId = Number(key);
      const tracked = deviceMap.get(traccarId);
      if (!tracked) return;
      const sourceId = `trail-${traccarId}`;
      const color = STATUS_COLORS[tracked.trackingStatus];
      const data: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiLineString", coordinates: lines },
      };
      try {
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(data);
          map.setPaintProperty(`trail-line-${traccarId}`, "line-color", color);
        } else if (map.isStyleLoaded()) {
          map.addSource(sourceId, { type: "geojson", data });
          map.addLayer({
            id: `trail-line-${traccarId}`,
            type: "line",
            source: sourceId,
            paint: { "line-color": color, "line-width": 3, "line-opacity": 0.6 },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        }
      } catch { /* style may not be ready */ }
    });

    // Remove the trails of vehicles that stopped reporting (and all of them in history mode)
    trailIdsRef.current.forEach((traccarId) => {
      if (shown[traccarId]) return;
      try {
        if (map.getLayer(`trail-line-${traccarId}`)) map.removeLayer(`trail-line-${traccarId}`);
        if (map.getSource(`trail-${traccarId}`)) map.removeSource(`trail-${traccarId}`);
      } catch { /* ignore */ }
    });
    trailIdsRef.current = new Set(Object.keys(shown).map(Number));
  }, [trails, devices, mapMode]);

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

      const query = new URLSearchParams({ deviceId: device.id, from: from.toISOString(), to: now.toISOString() });
      const res = await fetch(`/api/history?${query}`);

      if (!res.ok) throw new Error("Failed to fetch route");

      const history: {
        points: { latitude: number; longitude: number }[];
        route: { segments: [number, number][][] } | null;
      } = await res.json();

      if (history.points.length < 2) {
        setRouteLoading(false);
        return;
      }

      // Along the roads when the route was matched; otherwise the GPS fixes
      const coordinates = history.route
        ? history.route.segments.flat()
        : history.points.map((p) => [p.longitude, p.latitude]);
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

  /* ── History layers cleanup ────────────────────────── */
  const clearHistoryLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove segment layers/sources
    try {
      const style = map.getStyle();
      if (style?.layers) {
        style.layers.forEach((layer) => {
          if (layer.id.startsWith("history-seg-")) {
            try { map.removeLayer(layer.id); } catch {}
          }
        });
      }
      if (style?.sources) {
        Object.keys(style.sources).forEach((srcId) => {
          if (srcId.startsWith("history-seg-")) {
            try { map.removeSource(srcId); } catch {}
          }
        });
      }
    } catch {}

    // Remove history markers (stops + start/end)
    historyMarkersRef.current.forEach((m) => m.remove());
    historyMarkersRef.current = [];

    // Remove playback marker
    if (playbackMarkerRef.current) {
      playbackMarkerRef.current.remove();
      playbackMarkerRef.current = null;
    }

    // Cancel animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackTime(null);
    playbackTimeRef.current = null;
  }, []);

  /* ── Switch mode cleanup ───────────────────────────── */
  const switchToLive = useCallback(() => {
    clearHistoryLayers();
    routeHistory.clear();
    setHistoryDeviceId(null);
    setMapMode("live");
  }, [clearHistoryLayers, routeHistory]);

  const switchToHistory = useCallback(() => {
    setFollowingDeviceId(null);
    clearRoute();
    setDetailDeviceId(null);
    setMapMode("history");
  }, [clearRoute]);

  /* ── Render history segments on map ────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapMode !== "history" || routeHistory.segments.length === 0) return;

    const renderLayers = () => {
      // Clear previous history layers first
      try {
        const style = map.getStyle();
        if (style?.layers) {
          style.layers.forEach((layer) => {
            if (layer.id.startsWith("history-seg-")) {
              try { map.removeLayer(layer.id); } catch {}
            }
          });
        }
        if (style?.sources) {
          Object.keys(style.sources).forEach((srcId) => {
            if (srcId.startsWith("history-seg-")) {
              try { map.removeSource(srcId); } catch {}
            }
          });
        }
      } catch {}

      // Remove old markers
      historyMarkersRef.current.forEach((m) => m.remove());
      historyMarkersRef.current = [];

      const bounds = new maplibregl.LngLatBounds();

      // 1. Draw a continuous base line with ALL positions (ensures no gaps)
      // Along the roads when the route was matched; otherwise the GPS fixes
      const allCoords = routeHistory.baseLine ?? routeHistory.positions.map((p) => [p.longitude, p.latitude]);
      if (allCoords.length >= 2) {
        allCoords.forEach((c) => bounds.extend(c as [number, number]));
        try {
          map.addSource("history-seg-base", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: allCoords },
            },
          });
          map.addLayer({
            id: "history-seg-base-line",
            type: "line",
            source: "history-seg-base",
            paint: {
              "line-color": "#94A3B8",
              "line-width": 3,
              "line-opacity": 0.25,
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        } catch {}
      }

      // 2. Overlay colored segments on top, connecting each to the next
      routeHistory.segments.forEach((seg, i) => {
        const coords = seg.positions.map((p) => [p.longitude, p.latitude]);

        // Connect to previous segment: prepend last point of previous segment
        if (i > 0) {
          const prevSeg = routeHistory.segments[i - 1];
          const prevLast = prevSeg.positions[prevSeg.positions.length - 1];
          coords.unshift([prevLast.longitude, prevLast.latitude]);
        }

        // Connect to next segment: append first point of next segment
        if (i < routeHistory.segments.length - 1) {
          const nextSeg = routeHistory.segments[i + 1];
          const nextFirst = nextSeg.positions[0];
          coords.push([nextFirst.longitude, nextFirst.latitude]);
        }

        if (coords.length < 2) return;

        const sourceId = `history-seg-${i}`;
        const layerId = `history-seg-line-${i}`;

        try {
          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords },
            },
          });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": seg.color,
              "line-width": seg.type === "moving" ? 4 : 3,
              "line-opacity": seg.type === "moving" ? 0.85 : 0.5,
            },
            layout: { "line-cap": "round", "line-join": "round" },
          });
        } catch {}
      });

      // Stop markers
      routeHistory.stops.forEach((stop, i) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 24px; height: 24px; border-radius: 50%;
          background: #F59E0B; border: 2px solid #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
          cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        `;
        el.textContent = String(i + 1);

        const dur = stop.duration;
        const durStr = dur < 60000 ? `${Math.round(dur / 1000)}s`
          : dur < 3600000 ? `${Math.floor(dur / 60000)} min`
          : `${Math.floor(dur / 3600000)}h ${Math.floor((dur % 3600000) / 60000)}m`;

        const popup = new maplibregl.Popup({ offset: 14 }).setHTML(`
          <div style="font-family:system-ui;font-size:12px;">
            <strong style="color:#F59E0B;">Stop #${i + 1}</strong><br/>
            Duration: <b>${durStr}</b><br/>
            <span style="color:#94A3B8;font-size:11px;">${new Date(stop.startTime).toLocaleTimeString()} — ${new Date(stop.endTime).toLocaleTimeString()}</span>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(popup)
          .addTo(map);
        historyMarkersRef.current.push(marker);
      });

      // Start marker (green dot)
      if (routeHistory.positions.length > 0) {
        const first = routeHistory.positions[0];
        const startEl = document.createElement("div");
        startEl.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: #16A34A; border: 3px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        `;
        const startMarker = new maplibregl.Marker({ element: startEl })
          .setLngLat([first.longitude, first.latitude])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(
            `<div style="font-family:system-ui;font-size:12px;"><strong style="color:#16A34A;">Start</strong><br/>${new Date(first.fixTime).toLocaleTimeString()}</div>`
          ))
          .addTo(map);
        historyMarkersRef.current.push(startMarker);

        // End marker (red dot)
        const last = routeHistory.positions[routeHistory.positions.length - 1];
        const endEl = document.createElement("div");
        endEl.style.cssText = `
          width: 14px; height: 14px; border-radius: 50%;
          background: #EF4444; border: 3px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        `;
        const endMarker = new maplibregl.Marker({ element: endEl })
          .setLngLat([last.longitude, last.latitude])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(
            `<div style="font-family:system-ui;font-size:12px;"><strong style="color:#EF4444;">End</strong><br/>${new Date(last.fixTime).toLocaleTimeString()}</div>`
          ))
          .addTo(map);
        historyMarkersRef.current.push(endMarker);
      }

      // Fit bounds
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 80, duration: 1200 });
      }
    };

    if (map.isStyleLoaded()) {
      renderLayers();
    } else {
      map.once("style.load", renderLayers);
    }
  }, [routeHistory.segments, routeHistory.stops, routeHistory.positions, routeHistory.baseLine, mapMode]);

  /* ── Playback ──────────────────────────────────────── */
  const track = routeHistory.track;
  const trackStart = track.length ? track[0].t : 0;
  const trackEnd = track.length ? track[track.length - 1].t : 0;
  const fixTimes = useMemo(() => routeHistory.positions.map((p) => new Date(p.fixTime).getTime()), [routeHistory.positions]);

  // Puts the playback arrow where the vehicle was at trip time t
  const placePlaybackMarker = useCallback((t: number) => {
    const map = mapRef.current;
    const pos = positionAt(track, t);
    if (!map || !pos) return null;
    if (!playbackMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "cursor:pointer;line-height:0;";
      playbackMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
    }
    playbackMarkerRef.current.setLngLat([pos.lng, pos.lat]);
    playbackMarkerRef.current.getElement().innerHTML = createArrowSvg("#2563EB", pos.course);
    return pos;
  }, [track]);

  // Moves the clock (and the arrow) to trip time t, e.g. from the bar or the step buttons
  const seekTo = useCallback((t: number) => {
    const clamped = Math.min(trackEnd, Math.max(trackStart, t));
    playbackTimeRef.current = clamped;
    setPlaybackTime(clamped);
    const pos = placePlaybackMarker(clamped);
    if (pos) mapRef.current?.easeTo({ center: [pos.lng, pos.lat], duration: 300 });
  }, [trackStart, trackEnd, placePlaybackMarker]);

  useEffect(() => {
    if (!isPlaying || mapMode !== "history" || track.length < 2) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    let lastFrame = performance.now();
    let lastUiUpdate = 0;
    const tick = (now: number) => {
      const t = Math.min(trackEnd, advanceTime(playbackTimeRef.current ?? trackStart, now - lastFrame, playbackSpeed));
      lastFrame = now;
      playbackTimeRef.current = t;

      // Follow the vehicle
      const pos = placePlaybackMarker(t);
      if (pos) map.setCenter([pos.lng, pos.lat]);

      const finished = t >= trackEnd;
      if (finished || now - lastUiUpdate > 100) {
        lastUiUpdate = now;
        setPlaybackTime(t);
      }
      if (finished) {
        setIsPlaying(false);
        return;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, mapMode, track, trackStart, trackEnd, placePlaybackMarker]);

  /* ── Playback helpers ──────────────────────────────── */
  const formatPlaybackTime = useCallback(
    (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    []
  );

  const handlePlayPause = useCallback(() => {
    // Played to the end: start over
    if ((playbackTimeRef.current ?? trackStart) >= trackEnd) seekTo(trackStart);
    else if (playbackTimeRef.current === null) seekTo(trackStart);
    setIsPlaying((prev) => !prev);
  }, [trackStart, trackEnd, seekTo]);

  const handleSeek = useCallback(
    (pct: number) => seekTo(trackStart + pct * (trackEnd - trackStart)),
    [trackStart, trackEnd, seekTo]
  );

  // Step buttons: to the previous or next GPS report
  const handleStep = useCallback((direction: -1 | 1) => {
    setIsPlaying(false);
    seekTo(stepTo(fixTimes, playbackTimeRef.current ?? trackStart, direction));
  }, [fixTimes, trackStart, seekTo]);

  /* ── History search handler ────────────────────────── */
  const handleHistorySearch = useCallback((deviceId: string, from: Date, to: Date) => {
    clearHistoryLayers();
    setHistoryDeviceId(deviceId);
    routeHistory.fetchHistory(deviceId, from, to);
  }, [clearHistoryLayers, routeHistory]);

  /* ── Open a period from a link (reports, alerts, notifications) ── */
  // /map?history=1&deviceId=&from=&to=
  const searchParams = useSearchParams();
  const linkedHistory = useMemo(() => {
    const deviceId = searchParams.get("deviceId");
    const from = new Date(searchParams.get("from") ?? "");
    const to = new Date(searchParams.get("to") ?? "");
    if (searchParams.get("history") !== "1" || !deviceId || isNaN(from.getTime()) || isNaN(to.getTime())) {
      return null;
    }
    return { deviceId, from, to };
  }, [searchParams]);

  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    const key = searchParams.toString();
    if (!linkedHistory || openedLink.current === key) return;
    openedLink.current = key;
    switchToHistory();
    handleHistorySearch(linkedHistory.deviceId, linkedHistory.from, linkedHistory.to);
  }, [linkedHistory, searchParams, switchToHistory, handleHistorySearch]);

  const handleStopClick = useCallback((stop: StopEvent) => {
    mapRef.current?.flyTo({
      center: [stop.longitude, stop.latitude],
      zoom: 16,
      duration: 1000,
    });
  }, []);

  const handleSegmentClick = useCallback((segment: RouteSegment) => {
    if (segment.positions.length === 0) return;
    const mid = segment.positions[Math.floor(segment.positions.length / 2)];
    mapRef.current?.flyTo({
      center: [mid.longitude, mid.latitude],
      zoom: 15,
      duration: 1000,
    });
  }, []);

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

      {/* ── Live / History Toggle Pill ── */}
      <div className="absolute z-20 top-4 left-1/2 -translate-x-1/2 flex items-center bg-white/95 backdrop-blur-sm rounded-full shadow-md border border-[#E2E8F0] p-0.5">
        <button
          onClick={() => { if (mapMode !== "live") switchToLive(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            mapMode === "live"
              ? "bg-[#2563EB] text-white"
              : "text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${mapMode === "live" ? "bg-red-400 animate-pulse" : "bg-[#94A3B8]"}`} />
          Live
        </button>
        <button
          onClick={() => { if (mapMode !== "history") switchToHistory(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            mapMode === "history"
              ? "bg-[#2563EB] text-white"
              : "text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>
      </div>

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
          {/* ── History Panel (when in history mode) ── */}
          {mapMode === "history" ? (
            <HistoryPanel
              devices={devices}
              selectedDeviceId={historyDeviceId}
              onDeviceSelect={setHistoryDeviceId}
              onSearch={handleHistorySearch}
              onClose={switchToLive}
              loading={routeHistory.loading}
              error={routeHistory.error}
              summary={routeHistory.summary}
              stops={routeHistory.stops}
              segments={routeHistory.segments}
              onStopClick={handleStopClick}
              onSegmentClick={handleSegmentClick}
              initialFrom={linkedHistory?.from}
              initialTo={linkedHistory?.to}
            />
          ) : detailDevice ? (
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

      {/* ── Following indicator (live mode only) ── */}
      {mapMode === "live" && followingDeviceId && (
        <div className="absolute z-20 top-14 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#2563EB] text-white px-3 py-1.5 rounded-full shadow-lg text-[12px] font-medium">
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

      {/* ── Route indicator (live mode only) ── */}
      {mapMode === "live" && routeDeviceId && (
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

      {/* ── Playback Controls (history mode only) ── */}
      {mapMode === "history" && track.length > 1 && (
        <PlaybackControls
          isPlaying={isPlaying}
          speed={playbackSpeed}
          progress={trackEnd > trackStart ? ((playbackTime ?? trackStart) - trackStart) / (trackEnd - trackStart) : 0}
          currentTime={formatPlaybackTime(playbackTime ?? trackStart)}
          totalTime={formatPlaybackTime(trackEnd)}
          onPlayPause={handlePlayPause}
          onSpeedChange={setPlaybackSpeed}
          onSeek={handleSeek}
          onSkipStart={() => { setIsPlaying(false); seekTo(trackStart); }}
          onSkipEnd={() => { setIsPlaying(false); seekTo(trackEnd); }}
          onStepBack={() => handleStep(-1)}
          onStepForward={() => handleStep(1)}
          onClose={switchToLive}
        />
      )}

      {/* ── Sensor Overlay (floating on map, live mode only) ── */}
      {mapMode === "live" &&
        sensorOverlayOpen &&
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
        // Tailwind's ring-1 reads its color from this variable
        "--tw-ring-color": active ? color : undefined,
        borderColor: active ? color : undefined,
      } as React.CSSProperties}
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
            <VehicleIcon vehicleType={device.vehicleType} className="w-4 h-4" style={{ color }} />
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
