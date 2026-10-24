"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Phone,
  MessageSquare,
  Gauge,
  Compass,
  Clock,
  MapPin,
  Truck,
  Crosshair,
  Route,
  Eye,
  Share2,
  Check,
  User,
  Radio,
  Loader2,
  Pencil,
  Bell,
  Cpu,
  CalendarDays,
  Settings2,
  ExternalLink,
  LogIn,
  LogOut,
  Milestone,
} from "lucide-react";
import { trackerModel } from "@/lib/trackers";
import type { TrackedDevice, DeviceTrackingStatus } from "@/hooks/usePositions";
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

/* ── helpers ──────────────────────────────────────────── */

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function bearingFull(deg: number): string {
  const map: Record<string, string> = {
    N: "North",
    NE: "Northeast",
    E: "East",
    SE: "Southeast",
    S: "South",
    SW: "Southwest",
    W: "West",
    NW: "Northwest",
  };
  return map[bearingLabel(deg)] || "";
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

// "27 min", "1 h 05 min", "2 d 3 h"
function durationSince(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

const km = (value: number) => `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} km`;
const hours = (minutes: number) =>
  minutes < 60 ? `${Math.round(minutes)} min` : `${(minutes / 60).toLocaleString("en-US", { maximumFractionDigits: 1 })} h`;

interface VehicleOverview {
  state: { moving: boolean; since: string; currentTripKm: number } | null;
  today: { distanceKm: number; drivingMin: number; trips: number; stops: number; maxSpeedKmh: number };
  odometerKm: number | null;
  connection: { status: string; lastUpdate: string | null } | null;
  tracker: { model: string | null; simNumber: string | null; simCarrier: string | null };
  alerts: {
    today: number;
    recent: {
      id: string;
      type: "geofence_enter" | "geofence_exit" | "overspeed";
      time: string;
      speedKmh: number;
      limitKmh: number | null;
      readAt: string | null;
      geofence: { name: string } | null;
    }[];
  };
  permissions: { editDriver: boolean; configure: boolean };
}

const OVERVIEW_REFRESH_MS = 30_000;

async function fetchOverview(id: string): Promise<VehicleOverview | null> {
  const res = await fetch(`/api/devices/${id}/overview`);
  return res.ok ? res.json() : null;
}

const ALERT_ICONS = { geofence_enter: LogIn, geofence_exit: LogOut, overspeed: Gauge };
function alertText(a: VehicleOverview["alerts"]["recent"][number]) {
  if (a.type === "overspeed") return `Speeding · ${Math.round(a.speedKmh)} km/h${a.limitKmh ? ` (limit ${a.limitKmh})` : ""}`;
  const where = a.geofence?.name ?? "deleted geofence";
  return a.type === "geofence_enter" ? `Entered ${where}` : `Left ${where}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── geocode cache (shared) ──────────────────────────── */

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
  } catch {
    /* ignore */
  }
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/* ── types ────────────────────────────────────────────── */

interface DeviceDetailPanelProps {
  device: TrackedDevice;
  isFollowing: boolean;
  isRouteShown: boolean;
  routeLoading: boolean;
  onBack: () => void;
  onFollowToggle: () => void;
  onRouteToggle: () => void;
}

/* ── main component ──────────────────────────────────── */

export function DeviceDetailPanel({
  device,
  isFollowing,
  isRouteShown,
  routeLoading,
  onBack,
  onFollowToggle,
  onRouteToggle,
}: DeviceDetailPanelProps) {
  // Address resolved for a given position; a new position shows "loading" until its own
  // address arrives, without resetting state from the effect
  const [resolved, setResolved] = useState<{ key: string; address: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [overview, setOverview] = useState<{ id: string; data: VehicleOverview } | null>(null);
  // Driver as just saved, until the device list catches up
  const [savedDriver, setSavedDriver] = useState<{ id: string; name: string | null; phone: string | null } | null>(null);
  const [editingDriver, setEditingDriver] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchOverview(device.id).then((data) => {
        if (active && data) setOverview({ id: device.id, data });
      });
    load();
    const timer = setInterval(load, OVERVIEW_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [device.id]);

  const info = overview?.id === device.id ? overview.data : null;
  // "Moving for…" and the trip in progress only hold while it keeps reporting
  const reportingNow = device.trackingStatus === "moving" || device.trackingStatus === "stopped";
  const state = reportingNow ? info?.state ?? null : null;
  const driver =
    savedDriver?.id === device.id
      ? { name: savedDriver.name, phone: savedDriver.phone }
      : { name: device.driverName, phone: device.driverPhone };

  const color = STATUS_COLORS[device.trackingStatus];
  const statusLabel = STATUS_LABELS[device.trackingStatus];
  const hasPosition = !!device.position;

  const lat = device.position?.latitude;
  const lng = device.position?.longitude;
  const positionKey = lat !== undefined && lng !== undefined ? `${lat},${lng}` : null;
  const address = resolved && resolved.key === positionKey ? resolved.address : null;
  const addressLoading = positionKey !== null && resolved?.key !== positionKey;

  // Load address when device has position
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let active = true;
    reverseGeocode(lat, lng).then((addr) => {
      if (active) setResolved({ key: `${lat},${lng}`, address: addr });
    });
    return () => {
      active = false;
    };
  }, [lat, lng]);

  const handleCopyLocation = useCallback(async () => {
    if (!device.position) return;
    const text = `${device.position.latitude.toFixed(6)}, ${device.position.longitude.toFixed(6)}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [device.position]);

  const handleStreetView = useCallback(() => {
    if (!device.position) return;
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${device.position.latitude},${device.position.longitude}`;
    window.open(url, "_blank");
  }, [device.position]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── Header ────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-3 border-b border-[#F1F5F9]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-[#64748B] hover:text-[#0F172A] transition-colors mb-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to list
        </button>

        <div className="flex items-start gap-3">
          {/* Vehicle icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <VehicleIcon vehicleType={device.vehicleType} className="w-5 h-5" style={{ color }} />
          </div>

          {/* Name + plate + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#0F172A] truncate">
                {device.name}
              </h2>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {statusLabel}
              </span>
            </div>
            {device.vehiclePlate && (
              <p className="text-[12px] text-[#64748B] mt-0.5">
                {device.vehiclePlate}
              </p>
            )}
            {/* What it is doing and for how long, like "Stopped for 27 min" */}
            <p className="text-[12px] mt-1" style={{ color }}>
              {state
                ? `${state.moving ? "Moving" : "Stopped"} for ${durationSince(state.since)}`
                : device.lastUpdate
                  ? `No reports for ${durationSince(device.lastUpdate)}`
                  : "Never reported"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* ── Today ──────────────────────────────────── */}
        <Card>
          <CardLabel icon={CalendarDays} text="Today" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatTile icon={Route} label="Distance" value={info ? km(info.today.distanceKm) : "—"} />
            <StatTile icon={Clock} label="Driving" value={info ? hours(info.today.drivingMin) : "—"} />
            <StatTile icon={Milestone} label="Trips" value={info ? String(info.today.trips) : "—"} />
            <StatTile icon={MapPin} label="Stops" value={info ? String(info.today.stops) : "—"} />
          </div>
          <div className="mt-2 space-y-1.5">
            {state?.moving && (
              <InfoRow label="Current trip" value={`${km(state.currentTripKm)} · since ${new Date(state.since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} />
            )}
            <InfoRow label="Odometer (GPS)" value={info?.odometerKm != null ? km(info.odometerKm) : "—"} mono />
          </div>
        </Card>

        {/* ── Driver Card ────────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between">
            <CardLabel icon={User} text="Driver" />
            {info?.permissions.editDriver && !editingDriver && (
              <button
                onClick={() => setEditingDriver(true)}
                className="text-[#94A3B8] hover:text-[#2563EB] p-1 -m-1"
                aria-label="Edit driver"
                title="Edit driver"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {editingDriver ? (
            <DriverForm
              deviceId={device.id}
              name={driver.name}
              phone={driver.phone}
              onCancel={() => setEditingDriver(false)}
              onSaved={(name, phone) => {
                setSavedDriver({ id: device.id, name, phone });
                setEditingDriver(false);
              }}
            />
          ) : driver.name ? (
            <div className="flex items-center gap-3 mt-2">
              <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[13px] font-bold">{getInitials(driver.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">{driver.name}</p>
                {driver.phone && <p className="text-[11px] text-[#94A3B8]">{driver.phone}</p>}
              </div>
              {driver.phone && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <a
                    href={`tel:${driver.phone}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{ backgroundColor: "rgba(22,163,74,0.1)", color: "#16A34A" }}
                    title={`Call ${driver.name}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`sms:${driver.phone}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{ backgroundColor: "rgba(37,99,235,0.1)", color: "#2563EB" }}
                    title={`Message ${driver.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-[#94A3B8] mt-2 italic">No driver assigned</p>
          )}
        </Card>

        {/* ── Live Stats Grid ────────────────────────── */}
        <Card>
          <CardLabel icon={Gauge} text="Live Stats" />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatTile
              icon={Gauge}
              label="Speed"
              value={
                hasPosition
                  ? `${Math.round(device.position!.speed)} km/h`
                  : "—"
              }
              accent={hasPosition && device.position!.speed > 0}
            />
            <StatTile
              icon={Compass}
              label="Direction"
              value={
                hasPosition
                  ? bearingLabel(device.position!.course)
                  : "—"
              }
              subtitle={
                hasPosition
                  ? bearingFull(device.position!.course)
                  : undefined
              }
            />
            <StatTile
              icon={Radio}
              label="Status"
              customValue={
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[13px] font-semibold text-[#0F172A]">
                    {statusLabel}
                  </span>
                </div>
              }
            />
            <StatTile
              icon={Clock}
              label="Updated"
              value={
                device.lastUpdate ? timeAgo(device.lastUpdate) : "Never"
              }
            />
          </div>
        </Card>

        {/* ── Location Card ──────────────────────────── */}
        <Card>
          <CardLabel icon={MapPin} text="Current Location" />
          <div className="mt-2">
            {hasPosition ? (
              <>
                <p className="text-[13px] text-[#0F172A] leading-relaxed">
                  {addressLoading ? (
                    <span className="flex items-center gap-1.5 text-[#94A3B8]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading address...
                    </span>
                  ) : (
                    address || "Unknown address"
                  )}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">
                  {device.position!.latitude.toFixed(6)},{" "}
                  {device.position!.longitude.toFixed(6)}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-[#94A3B8] italic">
                No position data available
              </p>
            )}
          </div>
        </Card>

        {/* ── GPS tracker ────────────────────────────── */}
        <Card>
          <CardLabel icon={Cpu} text="GPS Tracker" />
          <div className="mt-2 space-y-2">
            <InfoRow label="Model" value={trackerModel(info?.tracker.model)?.name ?? "Not set"} />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#94A3B8]">Connection</span>
              {info?.connection ? (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    info.connection.status === "online" ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  {info.connection.status === "online" ? "Connected" : info.connection.status === "offline" ? "Disconnected" : "No recent data"}
                </span>
              ) : (
                <span className="text-[12px] text-[#0F172A]">—</span>
              )}
            </div>
            <InfoRow
              label="Last report"
              value={
                device.lastUpdate
                  ? `${timeAgo(device.lastUpdate)} · ${new Date(device.lastUpdate).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                  : "Never"
              }
            />
            <InfoRow label="IMEI" value={device.imei} mono />
            <InfoRow
              label="SIM"
              value={info?.tracker.simNumber ? `${info.tracker.simNumber}${info.tracker.simCarrier ? ` · ${info.tracker.simCarrier}` : ""}` : "Not set"}
              mono={!!info?.tracker.simNumber}
            />
            <InfoRow label="Device status" value={device.status} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {info?.permissions.configure && (
              <Link
                href={`/devices/${device.id}?tab=commands`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-white text-[#64748B] hover:bg-[#E2E8F0] border border-[#E2E8F0]"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Setup & SMS
              </Link>
            )}
            <Link
              href={`/devices/${device.id}`}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-white text-[#64748B] hover:bg-[#E2E8F0] border border-[#E2E8F0] ${
                info?.permissions.configure ? "" : "col-span-2"
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              More details
            </Link>
          </div>
        </Card>

        {/* ── Alerts ─────────────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between">
            <CardLabel icon={Bell} text="Alerts" />
            <span className="text-[11px] text-[#94A3B8]">{info ? `${info.alerts.today} today` : ""}</span>
          </div>
          {!info ? (
            <p className="text-[12px] text-[#94A3B8] mt-2">—</p>
          ) : info.alerts.recent.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8] mt-2 italic">No alerts yet</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {info.alerts.recent.map((a) => {
                const Icon = ALERT_ICONS[a.type];
                return (
                  <li key={a.id} className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${a.type === "overspeed" ? "text-[#EF4444]" : "text-[#2563EB]"}`} />
                    <span className={`text-[12px] flex-1 truncate ${a.readAt ? "text-[#64748B]" : "text-[#0F172A] font-medium"}`}>
                      {alertText(a)}
                    </span>
                    <span className="text-[11px] text-[#94A3B8] shrink-0">{timeAgo(a.time)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href={`/alerts?deviceId=${device.id}`}
            className="block text-[12px] font-medium text-[#2563EB] hover:underline mt-2.5"
          >
            View all alerts
          </Link>
        </Card>

        {/* ── Quick Actions ──────────────────────────── */}
        {hasPosition && (
          <Card>
            <CardLabel icon={Crosshair} text="Quick Actions" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <ActionButton
                icon={Crosshair}
                label={isFollowing ? "Unfollow" : "Follow"}
                active={isFollowing}
                onClick={onFollowToggle}
              />
              <ActionButton
                icon={Route}
                label={isRouteShown ? "Hide Route" : "Route"}
                active={isRouteShown}
                loading={routeLoading}
                onClick={onRouteToggle}
              />
              <ActionButton
                icon={Eye}
                label="Street View"
                onClick={handleStreetView}
              />
              <ActionButton
                icon={copied ? Check : Share2}
                label={copied ? "Copied!" : "Share"}
                active={copied}
                onClick={handleCopyLocation}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── sub-components ──────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#F8FAFC] rounded-xl p-3.5">{children}</div>
  );
}

function CardLabel({
  icon: Icon,
  text,
}: {
  icon: typeof Truck;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-[#94A3B8]" />
      <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
        {text}
      </span>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  subtitle,
  accent,
  customValue,
}: {
  icon: typeof Truck;
  label: string;
  value?: string;
  subtitle?: string;
  accent?: boolean;
  customValue?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg p-2.5">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3 text-[#94A3B8]" />
        <span className="text-[10px] text-[#94A3B8] font-medium">{label}</span>
      </div>
      {customValue || (
        <>
          <p
            className={`text-[13px] font-semibold ${
              accent ? "text-[#2563EB]" : "text-[#0F172A]"
            }`}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-[#94A3B8]">{subtitle}</p>
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#94A3B8]">{label}</span>
      <span
        className={`text-[12px] text-[#0F172A] font-medium ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  active,
  loading,
  onClick,
}: {
  icon: typeof Truck;
  label: string;
  active?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
        active
          ? "bg-[#2563EB] text-white shadow-sm"
          : "bg-white text-[#64748B] hover:bg-[#E2E8F0] border border-[#E2E8F0]"
      }`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );
}

function DriverForm({
  deviceId,
  name,
  phone,
  onCancel,
  onSaved,
}: {
  deviceId: string;
  name: string | null;
  phone: string | null;
  onCancel: () => void;
  onSaved: (name: string | null, phone: string | null) => void;
}) {
  const [driverName, setDriverName] = useState(name ?? "");
  const [driverPhone, setDriverPhone] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { driverName: driverName.trim() || null, driverPhone: driverPhone.trim() || null };
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved(body.driverName, body.driverPhone);
    else setError((await res.json().catch(() => ({}))).error || "Could not save the driver");
  }

  const input =
    "w-full px-2.5 py-1.5 text-[12px] bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-[#2563EB]";
  return (
    <form onSubmit={save} className="mt-2 space-y-2">
      <input className={input} value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver's name" autoFocus />
      <input className={input} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="Phone, e.g. +18095551234" type="tel" />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#64748B] hover:bg-[#E2E8F0]">
          Cancel
        </button>
      </div>
    </form>
  );
}
