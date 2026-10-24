"use client";

import { useEffect, useState, type ReactNode } from "react";

interface DeviceOption {
  id: string;
  name: string;
  vehiclePlate: string | null;
  traccarId: number | null;
}

type Preset = "today" | "yesterday" | "week";

// "YYYY-MM-DDTHH:mm" in local time, the format datetime-local inputs use
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function presetRange(preset: Preset) {
  const now = new Date();
  if (preset === "today") return { from: startOfDay(now), to: now };
  if (preset === "yesterday") {
    const to = startOfDay(now);
    return { from: new Date(to.getTime() - 24 * 3600 * 1000), to };
  }
  return { from: new Date(now.getTime() - 7 * 24 * 3600 * 1000), to: now };
}

// Device and date range shared by the history and the reports. `initial` comes from the
// URL so a report row can open the history on that exact device and period.
export function useDeviceRange(initial?: { deviceId?: string | null; from?: string | null; to?: string | null }) {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [deviceId, setDeviceId] = useState(initial?.deviceId ?? "");
  const [from, setFrom] = useState(() =>
    toLocalInput(initial?.from ? new Date(initial.from) : presetRange("today").from)
  );
  const [to, setTo] = useState(() =>
    toLocalInput(initial?.to ? new Date(initial.to) : presetRange("today").to)
  );

  useEffect(() => {
    fetch("/api/devices")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DeviceOption[]) => {
        const linked = data.filter((d) => d.traccarId);
        setDevices(linked);
        setDeviceId((current) =>
          linked.some((d) => d.id === current) ? current : linked[0]?.id ?? ""
        );
        setDevicesLoaded(true);
      });
  }, []);

  function applyPreset(preset: Preset) {
    const range = presetRange(preset);
    setFrom(toLocalInput(range.from));
    setTo(toLocalInput(range.to));
  }

  function query() {
    return new URLSearchParams({
      deviceId,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
  }

  return { devices, devicesLoaded, deviceId, setDeviceId, from, setFrom, to, setTo, applyPreset, query };
}

export function DeviceRangeFilters({
  range,
  onSubmit,
  loading,
  submitLabel,
  children,
}: {
  range: ReturnType<typeof useDeviceRange>;
  onSubmit: () => void;
  loading: boolean;
  submitLabel: string;
  // Extra fields shown before the submit button
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 bg-white border rounded-lg p-4">
      <label className="flex flex-col gap-1 text-sm">
        Device
        <select
          value={range.deviceId}
          onChange={(e) => range.setDeviceId(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm min-w-48"
        >
          {range.devices.length === 0 && <option value="">No linked devices</option>}
          {range.devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.vehiclePlate ? ` · ${d.vehiclePlate}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        From
        <input
          type="datetime-local"
          value={range.from}
          onChange={(e) => range.setFrom(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        To
        <input
          type="datetime-local"
          value={range.to}
          onChange={(e) => range.setTo(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-1">
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "Last 7 days"],
          ] as const
        ).map(([preset, label]) => (
          <button
            key={preset}
            onClick={() => range.applyPreset(preset)}
            className="px-3 py-2 border rounded-md text-sm hover:bg-zinc-100"
          >
            {label}
          </button>
        ))}
      </div>
      {children}
      <button
        onClick={onSubmit}
        disabled={!range.deviceId || loading}
        className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800 disabled:opacity-50"
      >
        {loading ? "Loading..." : submitLabel}
      </button>
    </div>
  );
}
