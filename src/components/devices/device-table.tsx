"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Device {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  speedLimitKmh: number | null;
}

const DEFAULT_LIMIT_KMH = 80;

// Speed limit for overspeed alerts; saved when the field loses focus. Empty = default.
function SpeedLimitInput({ device }: { device: Device }) {
  const [value, setValue] = useState(device.speedLimitKmh?.toString() ?? "");
  const [savedLimit, setSavedLimit] = useState(device.speedLimitKmh);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function save() {
    const limit = value.trim() === "" ? null : Number(value);
    if (limit === savedLimit) return;
    const res = await fetch(`/api/devices/${device.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speedLimitKmh: limit }),
    });
    if (res.ok) {
      setSavedLimit(limit);
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={10}
        max={200}
        value={value}
        placeholder={String(DEFAULT_LIMIT_KMH)}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label={`Speed limit for ${device.name} (km/h)`}
        className="w-20 border rounded-md px-2 py-1 text-sm"
      />
      {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
      {status === "error" && <span className="text-xs text-red-600">10–200</span>}
    </div>
  );
}

// The page owns the list: a copy in local state would stay empty when the devices
// arrive after the first render
export function DeviceTable({
  devices,
  onDeleted,
}: {
  devices: Device[];
  onDeleted: () => void;
}) {
  async function handleDelete(id: string) {
    if (!confirm("Delete this device?")) return;
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-zinc-50">
            <th className="text-left p-3 font-medium">Name</th>
            <th className="text-left p-3 font-medium">IMEI</th>
            <th className="text-left p-3 font-medium">Plate</th>
            <th className="text-left p-3 font-medium">Type</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-left p-3 font-medium">Speed limit (km/h)</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} className="border-b last:border-0">
              <td className="p-3 font-medium">{device.name}</td>
              <td className="p-3 text-zinc-500 font-mono text-xs">
                {device.imei}
              </td>
              <td className="p-3">{device.vehiclePlate || "\u2014"}</td>
              <td className="p-3">{device.vehicleType || "\u2014"}</td>
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    device.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {device.status}
                </span>
              </td>
              <td className="p-3">
                <SpeedLimitInput device={device} />
              </td>
              <td className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(device.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </td>
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-zinc-400">
                No devices yet. Add your first device.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
