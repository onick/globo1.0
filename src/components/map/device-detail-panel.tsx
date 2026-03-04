"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  Phone,
  MessageSquare,
  Gauge,
  Compass,
  Clock,
  MapPin,
  Truck,
  Car,
  Bike,
  Crosshair,
  Route,
  Eye,
  Share2,
  Check,
  User,
  Radio,
  Loader2,
} from "lucide-react";
import type { TrackedDevice, DeviceTrackingStatus } from "@/hooks/usePositions";

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

const VEHICLE_ICONS: Record<string, typeof Truck> = {
  truck: Truck,
  van: Truck,
  pickup: Car,
  car: Car,
  motorcycle: Bike,
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
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const color = STATUS_COLORS[device.trackingStatus];
  const statusLabel = STATUS_LABELS[device.trackingStatus];
  const hasPosition = !!device.position;
  const VehicleIcon = VEHICLE_ICONS[device.vehicleType || "truck"] || Truck;

  // Load address when device has position
  useEffect(() => {
    if (!device.position) {
      setAddress(null);
      return;
    }
    setAddressLoading(true);
    reverseGeocode(device.position.latitude, device.position.longitude).then(
      (addr) => {
        setAddress(addr);
        setAddressLoading(false);
      }
    );
  }, [device.position?.latitude, device.position?.longitude]);

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
            <VehicleIcon className="w-5 h-5" style={{ color }} />
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
          </div>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* ── Driver Card ────────────────────────────── */}
        <Card>
          <CardLabel icon={User} text="Driver" />
          {device.driverName ? (
            <div className="flex items-center gap-3 mt-2">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[13px] font-bold">
                  {getInitials(device.driverName)}
                </span>
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">
                  {device.driverName}
                </p>
                {device.driverPhone && (
                  <p className="text-[11px] text-[#94A3B8]">
                    {device.driverPhone}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {device.driverPhone && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <a
                    href={`tel:${device.driverPhone}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: "rgba(22,163,74,0.1)",
                      color: "#16A34A",
                    }}
                    title={`Call ${device.driverName}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`sms:${device.driverPhone}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: "rgba(37,99,235,0.1)",
                      color: "#2563EB",
                    }}
                    title={`Message ${device.driverName}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-[#94A3B8] mt-2 italic">
              No driver assigned
            </p>
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

        {/* ── Vehicle Info Card ──────────────────────── */}
        <Card>
          <CardLabel icon={VehicleIcon} text="Vehicle Info" />
          <div className="mt-2 space-y-2">
            <InfoRow
              label="Type"
              value={
                device.vehicleType
                  ? device.vehicleType.charAt(0).toUpperCase() +
                    device.vehicleType.slice(1)
                  : "Not specified"
              }
            />
            <InfoRow label="IMEI" value={device.imei} mono />
            {device.vehiclePlate && (
              <InfoRow label="Plate" value={device.vehiclePlate} />
            )}
            {device.traccarId && (
              <InfoRow
                label="Traccar ID"
                value={String(device.traccarId)}
                mono
              />
            )}
            <InfoRow label="Device Status" value={device.status} />
          </div>
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
