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
}

export function DeviceTable({
  devices: initialDevices,
}: {
  devices: Device[];
}) {
  const [devices, setDevices] = useState(initialDevices);

  async function handleDelete(id: string) {
    if (!confirm("Delete this device?")) return;
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDevices(devices.filter((d) => d.id !== id));
    }
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
              <td colSpan={6} className="p-8 text-center text-zinc-400">
                No devices yet. Add your first device.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
