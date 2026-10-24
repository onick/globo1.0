"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Hexagon, Loader2, MousePointerClick, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { useCan } from "@/components/shared/role-provider";
import { BASE_MAP_STYLE } from "@/lib/map-style";
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
  const canManage = useCan("geofences:manage");
  // Read by the map's click handler, which is set up once
  const canManageRef = useRef(canManage);
  const [mapReady, setMapReady] = useState(false);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState(200);
  const [tenantId, setTenantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped to reload the list after saving
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/geofences")
      .then((res) => (res.ok ? res.json() : null))
      .then((list: Geofence[] | null) => {
        if (active && list) setGeofences(list);
      });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/admin/tenants")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Tenant[]) => {
          setTenants(data);
          if (data.length) setTenantId(data[0].id);
        });
    }
  }, [isSuperAdmin]);

  // Map: saved geofences in blue, the one being drawn in orange; click to place the center
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASE_MAP_STYLE,
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
      map.on("click", (e) => {
        if (canManageRef.current) setCenter({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      });
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
    toast.success(`Geofence "${name.trim()}" saved`);
    setCenter(null);
    setName("");
    setVersion((v) => v + 1);
  }

  async function remove(g: Geofence) {
    const res = await fetch(`/api/geofences/${g.id}`, { method: "DELETE" });
    if (res.ok) {
      setGeofences((list) => list.filter((x) => x.id !== g.id));
      toast.success(`Geofence "${g.name}" deleted`);
    } else {
      toast.error("Could not delete the geofence");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Geofences"
        description="Areas that raise an alert when a vehicle enters or leaves them"
      />

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-13rem)]">
        <div className="relative h-96 lg:h-auto lg:flex-1 rounded-xl overflow-hidden border bg-card">
          <div ref={mapContainer} className="w-full h-full" />
          {canManage && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-card/95 backdrop-blur px-3 py-2 rounded-lg border shadow-sm text-sm">
              {center ? (
                <>
                  <Crosshair className="size-4 text-orange-500" />
                  <span className="tabular-nums">
                    {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
                  </span>
                  <span className="text-muted-foreground">· click again to move it</span>
                </>
              ) : (
                <>
                  <MousePointerClick className="size-4 text-primary" />
                  Click the map to place a new geofence
                </>
              )}
            </div>
          )}
        </div>

        <div className="lg:w-80 flex flex-col gap-4 min-h-0">
          {canManage && (
            <div className="bg-card border rounded-xl p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">New geofence</h2>
                <p className="text-xs text-muted-foreground mt-0.5">A circle around the point you click on the map.</p>
              </div>
              {isSuperAdmin && (
                <FormField label="Client">
                  <Select value={tenantId} onValueChange={setTenantId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              <FormField label="Name" htmlFor="geofence-name">
                <Input id="geofence-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main depot" />
              </FormField>
              <FormField label="Radius (m)" htmlFor="geofence-radius" hint={`Between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} m`}>
                <Input
                  id="geofence-radius"
                  type="number"
                  min={MIN_RADIUS_M}
                  max={MAX_RADIUS_M}
                  step={10}
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                />
              </FormField>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                {center && (
                  <Button variant="outline" onClick={() => setCenter(null)}>
                    Cancel
                  </Button>
                )}
                <Button onClick={save} disabled={!center || !name.trim() || saving} className="flex-1">
                  {saving && <Loader2 className="animate-spin" />}
                  {center ? "Save geofence" : "Place it on the map first"}
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-xl lg:flex-1 lg:overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold text-foreground">Geofences</h2>
              <span className="text-xs text-muted-foreground">{geofences.length}</span>
            </div>
            {geofences.length === 0 ? (
              <div className="px-4 pb-6 pt-2 text-center">
                <Hexagon className="size-8 text-slate-300 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">No geofences yet.</p>
              </div>
            ) : (
              <ul className="px-2 pb-2">
                {geofences.map((g) => (
                  <li key={g.id} className="group flex items-center gap-1 rounded-lg hover:bg-accent">
                    <button onClick={() => focus(g)} className="flex-1 min-w-0 text-left px-2 py-2">
                      <div className="text-sm font-medium text-foreground truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.radiusM} m{isSuperAdmin ? ` · ${g.tenant.name}` : ""}
                      </div>
                    </button>
                    {canManage && (
                      <ConfirmDialog
                        title={`Delete "${g.name}"?`}
                        description="Vehicles will stop raising alerts for this area. Past alerts are kept."
                        onConfirm={() => remove(g)}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${g.name}`} className="text-muted-foreground hover:text-destructive">
                            <Trash2 />
                          </Button>
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
