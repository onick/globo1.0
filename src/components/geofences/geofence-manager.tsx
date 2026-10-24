"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Trash2 } from "lucide-react";
import { OSM_STYLE } from "@/lib/map-style";
import { circlePolygon, MAX_RADIUS_M, MIN_RADIUS_M } from "@/lib/geofences";

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  tenantId: string;
  tenant: { name: string };
}

interface Tenant {
  id: string;
  name: string;
}

const circleFeature = (lat: number, lon: number, r: number, properties: Record<string, unknown> = {}) => ({
  type: "Feature" as const,
  properties,
  geometry: { type: "Polygon" as const, coordinates: [circlePolygon(lat, lon, r)] },
});

export function GeofenceManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState(200);
  const [tenantId, setTenantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/geofences");
    if (res.ok) setGeofences(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    if (isSuperAdmin) {
      fetch("/api/admin/tenants")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Tenant[]) => {
          setTenants(data);
          if (data.length) setTenantId(data[0].id);
        });
    }
  }, [load, isSuperAdmin]);

  // Map: saved geofences in blue, the one being drawn in orange; click to place the center
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
      const empty = { type: "FeatureCollection" as const, features: [] };
      map.addSource("geofences", { type: "geojson", data: empty });
      map.addLayer({ id: "geofences-fill", type: "fill", source: "geofences", paint: { "fill-color": "#2563eb", "fill-opacity": 0.15 } });
      map.addLayer({ id: "geofences-line", type: "line", source: "geofences", paint: { "line-color": "#2563eb", "line-width": 2 } });
      map.addLayer({
        id: "geofences-label",
        type: "symbol",
        source: "geofences",
        layout: { "text-field": ["get", "name"], "text-size": 12 },
        paint: { "text-color": "#1e3a8a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      });
      map.addSource("draft", { type: "geojson", data: empty });
      map.addLayer({ id: "draft-fill", type: "fill", source: "draft", paint: { "fill-color": "#f97316", "fill-opacity": 0.2 } });
      map.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#f97316", "line-width": 2, "line-dasharray": [2, 1] } });
      map.on("click", (e) => setCenter({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }));
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource("geofences") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: geofences.map((g) => circleFeature(g.latitude, g.longitude, g.radiusM, { name: g.name })),
    });
  }, [geofences, mapReady]);

  useEffect(() => {
    const source = mapRef.current?.getSource("draft") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: center ? [circleFeature(center.latitude, center.longitude, radiusM)] : [],
    });
  }, [center, radiusM, mapReady]);

  function focus(g: Geofence) {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new maplibregl.LngLatBounds();
    circlePolygon(g.latitude, g.longitude, g.radiusM, 16).forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
  }

  async function save() {
    if (!center) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/geofences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        latitude: center.latitude,
        longitude: center.longitude,
        radiusM,
        ...(isSuperAdmin ? { tenantId } : {}),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save the geofence");
      return;
    }
    setCenter(null);
    setName("");
    load();
  }

  async function remove(g: Geofence) {
    if (!confirm(`Delete geofence "${g.name}"? Past alerts are kept.`)) return;
    const res = await fetch(`/api/geofences/${g.id}`, { method: "DELETE" });
    if (res.ok) setGeofences((list) => list.filter((x) => x.id !== g.id));
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-8rem)]">
      <div className="relative h-96 lg:h-auto lg:flex-1 rounded-lg overflow-hidden border">
        <div ref={mapContainer} className="w-full h-full" />
        {!center && (
          <div className="absolute top-3 left-3 bg-white px-3 py-1.5 rounded-md shadow text-sm">
            Click the map to place a new geofence
          </div>
        )}
      </div>

      <div className="lg:w-80 flex flex-col gap-4 min-h-0">
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">New geofence</h2>
          {isSuperAdmin && (
            <label className="flex flex-col gap-1 text-sm">
              Client
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main depot" className="border rounded-md px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Radius (m)
            <input
              type="number"
              min={MIN_RADIUS_M}
              max={MAX_RADIUS_M}
              step={10}
              value={radiusM}
              onChange={(e) => setRadiusM(Number(e.target.value))}
              className="border rounded-md px-3 py-2 text-sm"
            />
          </label>
          <div className="text-xs text-zinc-500 tabular-nums">
            {center ? `Center: ${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}` : "No center yet"}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            onClick={save}
            disabled={!center || !name.trim() || saving}
            className="w-full px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save geofence"}
          </button>
        </div>

        <div className="bg-white border rounded-lg lg:flex-1 lg:overflow-y-auto">
          <h2 className="font-semibold px-4 pt-4 pb-2">Geofences ({geofences.length})</h2>
          {geofences.length === 0 && <p className="px-4 pb-4 text-sm text-zinc-500">None yet.</p>}
          <ul>
            {geofences.map((g) => (
              <li key={g.id} className="flex items-center justify-between border-t px-4 py-2 text-sm">
                <button onClick={() => focus(g)} className="text-left">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-zinc-500">
                    {g.radiusM} m{isSuperAdmin ? ` · ${g.tenant.name}` : ""}
                  </div>
                </button>
                <button onClick={() => remove(g)} aria-label={`Delete ${g.name}`} className="p-1.5 rounded hover:bg-zinc-100">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
