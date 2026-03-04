"use client";

import { useState, useMemo } from "react";
import {
  History,
  X,
  Search,
  Loader2,
  Route,
  Clock,
  Gauge,
  Timer,
  CircleStop,
  TrendingUp,
  MapPin,
} from "lucide-react";
import type { TrackedDevice } from "@/hooks/usePositions";
import type { TripSummary, StopEvent, RouteSegment } from "@/hooks/useRouteHistory";

/* ── Helpers ───────────────────────────────────────────── */

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  const remainder = min % 60;
  return remainder > 0 ? `${hrs}h ${remainder}m` : `${hrs}h`;
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLocalDatetime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ── Props ─────────────────────────────────────────────── */

interface HistoryPanelProps {
  devices: TrackedDevice[];
  selectedDeviceId: string | null;
  onDeviceSelect: (deviceId: string) => void;
  onSearch: (deviceId: string, from: Date, to: Date) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  summary: TripSummary | null;
  stops: StopEvent[];
  segments: RouteSegment[];
  onStopClick: (stop: StopEvent) => void;
  onSegmentClick: (segment: RouteSegment) => void;
}

/* ── Component ─────────────────────────────────────────── */

export function HistoryPanel({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  onSearch,
  onClose,
  loading,
  error,
  summary,
  stops,
  segments,
  onStopClick,
  onSegmentClick,
}: HistoryPanelProps) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [fromValue, setFromValue] = useState(toLocalDatetime(todayStart));
  const [toValue, setToValue] = useState(toLocalDatetime(now));

  // Only devices with traccarId
  const availableDevices = useMemo(
    () => devices.filter((d) => d.traccarId !== null),
    [devices]
  );

  // Build timeline events (movements + stops interleaved)
  const timelineEvents = useMemo(() => {
    return segments.map((seg, i) => ({
      id: i,
      type: seg.type,
      startTime: seg.startTime,
      endTime: seg.endTime,
      duration: new Date(seg.endTime).getTime() - new Date(seg.startTime).getTime(),
      distance: seg.distance,
      avgSpeed: seg.avgSpeed,
      maxSpeed: seg.maxSpeed,
      segment: seg,
      stop: seg.type === "stopped" ? stops.find(
        (s) => s.startTime === seg.startTime
      ) : undefined,
    }));
  }, [segments, stops]);

  function handleSearch() {
    if (!selectedDeviceId) return;
    const from = new Date(fromValue);
    const to = new Date(toValue);
    onSearch(selectedDeviceId, from, to);
  }

  function applyPreset(preset: string) {
    const now = new Date();
    let from = new Date();

    if (preset === "today") {
      from.setHours(0, 0, 0, 0);
    } else if (preset === "yesterday") {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 59, 999);
    } else if (preset === "7days") {
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
    }

    setFromValue(toLocalDatetime(from));
    setToValue(toLocalDatetime(now));
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#2563EB]" />
            <span className="text-[14px] font-semibold text-[#0F172A]">
              Movement History
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#F1F5F9] rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* Device Selector */}
        <select
          value={selectedDeviceId || ""}
          onChange={(e) => onDeviceSelect(e.target.value)}
          className="w-full px-3 py-2 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] transition-colors"
        >
          <option value="">Select a device...</option>
          {availableDevices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.vehiclePlate ? ` (${d.vehiclePlate})` : ""}
            </option>
          ))}
        </select>

        {/* Date/Time Range */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              From
            </label>
            <input
              type="datetime-local"
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              To
            </label>
            <input
              type="datetime-local"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex gap-1.5 mt-2">
          {[
            { label: "Today", key: "today" },
            { label: "Yesterday", key: "yesterday" },
            { label: "7 days", key: "7days" },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className="px-2.5 py-1 text-[11px] font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-md hover:bg-[#F8FAFC] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!selectedDeviceId || loading}
          className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-[#2563EB] text-white text-[13px] font-medium rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? "Loading..." : "Search History"}
        </button>
      </div>

      {/* Content area (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {/* Error */}
        {error && (
          <div className="px-4 py-3">
            <div className="text-[12px] text-[#F59E0B] bg-[#FEF3C7] rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          </div>
        )}

        {/* Trip Summary */}
        {summary && (
          <div className="px-4 py-3 border-b border-[#F1F5F9]">
            <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
              Trip Summary
            </div>
            <div className="bg-[#F8FAFC] rounded-xl p-3">
              <div className="grid grid-cols-3 gap-2">
                <StatTile
                  icon={Route}
                  label="Distance"
                  value={formatKm(summary.totalDistance)}
                />
                <StatTile
                  icon={Clock}
                  label="Duration"
                  value={formatDuration(summary.totalDuration)}
                />
                <StatTile
                  icon={Gauge}
                  label="Max Speed"
                  value={`${Math.round(summary.maxSpeed)} km/h`}
                />
                <StatTile
                  icon={TrendingUp}
                  label="Avg Speed"
                  value={`${Math.round(summary.avgSpeed)} km/h`}
                />
                <StatTile
                  icon={Timer}
                  label="Moving"
                  value={formatDuration(summary.movingDuration)}
                />
                <StatTile
                  icon={CircleStop}
                  label="Stops"
                  value={String(summary.stopCount)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Event Timeline */}
        {timelineEvents.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
              Timeline
            </div>
            <div className="space-y-0">
              {timelineEvents.map((event, i) => (
                <button
                  key={event.id}
                  onClick={() => {
                    if (event.stop) {
                      onStopClick(event.stop);
                    } else {
                      onSegmentClick(event.segment);
                    }
                  }}
                  className="w-full flex items-start gap-3 py-2 text-left hover:bg-[#F8FAFC] rounded-lg px-2 transition-colors"
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center pt-0.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          event.type === "moving" ? "#16A34A" : "#F59E0B",
                      }}
                    />
                    {i < timelineEvents.length - 1 && (
                      <div className="w-0.5 h-8 bg-[#E2E8F0] mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {event.type === "moving" ? (
                        <MapPin className="w-3 h-3 text-[#16A34A]" />
                      ) : (
                        <CircleStop className="w-3 h-3 text-[#F59E0B]" />
                      )}
                      <span className="text-[12px] font-medium text-[#0F172A]">
                        {event.type === "moving"
                          ? "Moving"
                          : `Stopped ${formatDuration(event.duration)}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] block">
                      {formatTime(event.startTime)} — {formatTime(event.endTime)}
                    </span>
                    {event.type === "moving" && (
                      <span className="text-[10px] text-[#64748B] block">
                        {formatKm(event.distance)} · avg{" "}
                        {Math.round(event.avgSpeed)} km/h · max{" "}
                        {Math.round(event.maxSpeed)} km/h
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !summary && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <History className="w-10 h-10 text-[#E2E8F0] mb-2" />
            <p className="text-[13px] text-[#94A3B8]">
              Select a device and date range to view movement history
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── StatTile ──────────────────────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <Icon className="w-3.5 h-3.5 text-[#94A3B8] mx-auto mb-0.5" />
      <div className="text-[13px] font-semibold text-[#0F172A]">{value}</div>
      <div className="text-[10px] text-[#94A3B8]">{label}</div>
    </div>
  );
}
