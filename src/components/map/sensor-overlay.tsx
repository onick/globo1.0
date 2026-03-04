"use client";

import {
  Activity,
  Power,
  Battery,
  Gauge,
  Timer,
  Zap,
  MapPin,
  X,
} from "lucide-react";
import type { PositionAttributes } from "@/hooks/usePositions";

/* ── helpers ──────────────────────────────────────────── */

function formatEngineHours(ms: number): string {
  const totalHours = ms / 3600000;
  if (totalHours < 1) return `${Math.round(totalHours * 60)} min`;
  return `${totalHours.toFixed(1)} h`;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(2)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function batteryColor(level: number): string {
  if (level > 50) return "#16A34A";
  if (level > 20) return "#F59E0B";
  return "#EF4444";
}

/* ── types ────────────────────────────────────────────── */

interface SensorOverlayProps {
  attributes: PositionAttributes;
  speed: number;
  onClose: () => void;
}

/* ── component ─────────────────────────────────────────── */

export function SensorOverlay({ attributes, speed, onClose }: SensorOverlayProps) {
  const hasAnyData =
    attributes.motion !== undefined ||
    attributes.ignition !== undefined ||
    attributes.batteryLevel !== undefined ||
    attributes.totalDistance !== undefined ||
    attributes.hours !== undefined;

  if (!hasAnyData) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#E2E8F0] overflow-hidden w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#F1F5F9] bg-[#F8FAFC]">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#64748B]" />
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Sensors
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#E2E8F0] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Sensor grid */}
      <div className="grid grid-cols-2 gap-px bg-[#F1F5F9]">
        {/* Motion */}
        {attributes.motion !== undefined && (
          <SensorCell
            icon={Activity}
            label="Motion"
            value={attributes.motion ? "Moving" : "Stopped"}
            dotColor={attributes.motion ? "#16A34A" : "#F59E0B"}
          />
        )}

        {/* Ignition */}
        {attributes.ignition !== undefined && (
          <SensorCell
            icon={Power}
            label="Ignition"
            value={attributes.ignition ? "ON" : "OFF"}
            dotColor={attributes.ignition ? "#16A34A" : "#EF4444"}
          />
        )}

        {/* Battery */}
        {attributes.batteryLevel !== undefined && (
          <div className="bg-white px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Battery className="w-3 h-3 text-[#94A3B8]" />
              <span className="text-[9px] text-[#94A3B8] font-medium uppercase">
                Battery
              </span>
            </div>
            <p
              className="text-[13px] font-bold"
              style={{ color: batteryColor(attributes.batteryLevel!) }}
            >
              {Math.round(attributes.batteryLevel!)}%
            </p>
            <div className="w-full h-1 bg-[#F1F5F9] rounded-full mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, attributes.batteryLevel!))}%`,
                  backgroundColor: batteryColor(attributes.batteryLevel!),
                }}
              />
            </div>
          </div>
        )}

        {/* Speed */}
        <div className="bg-white px-3 py-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Gauge className="w-3 h-3 text-[#94A3B8]" />
            <span className="text-[9px] text-[#94A3B8] font-medium uppercase">
              Speed
            </span>
          </div>
          <p className={`text-[13px] font-bold ${speed > 0 ? "text-[#2563EB]" : "text-[#0F172A]"}`}>
            {Math.round(speed)} km/h
          </p>
        </div>

        {/* Distance */}
        {attributes.totalDistance !== undefined && (
          <div className="bg-white px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <MapPin className="w-3 h-3 text-[#94A3B8]" />
              <span className="text-[9px] text-[#94A3B8] font-medium uppercase">
                Distance
              </span>
            </div>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {formatDistance(attributes.totalDistance!)}
            </p>
          </div>
        )}

        {/* Engine Hours */}
        {attributes.hours !== undefined && (
          <div className="bg-white px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Timer className="w-3 h-3 text-[#94A3B8]" />
              <span className="text-[9px] text-[#94A3B8] font-medium uppercase">
                Engine Hrs
              </span>
            </div>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {formatEngineHours(attributes.hours!)}
            </p>
          </div>
        )}

        {/* ACC */}
        {attributes.ignition !== undefined && (
          <SensorCell
            icon={Zap}
            label="ACC"
            value={attributes.ignition ? "ON" : "OFF"}
            dotColor={attributes.ignition ? "#2563EB" : "#94A3B8"}
          />
        )}
      </div>
    </div>
  );
}

/* ── sub-component ──────────────────────────────────── */

function SensorCell({
  icon: Icon,
  label,
  value,
  dotColor,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  dotColor: string;
}) {
  return (
    <div className="bg-white px-3 py-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 text-[#94A3B8]" />
        <span className="text-[9px] text-[#94A3B8] font-medium uppercase">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <p className="text-[13px] font-bold" style={{ color: dotColor }}>
          {value}
        </p>
      </div>
    </div>
  );
}
