"use client";

import { useState } from "react";
import { Trash2, Cpu } from "lucide-react";

interface Device {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
}

export function DeviceTable({ devices: initialDevices }: { devices: Device[] }) {
  const [devices, setDevices] = useState(initialDevices);

  async function handleDelete(id: string) {
    if (!confirm("Delete this device?")) return;
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDevices(devices.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>IMEI</th>
            <th>Plate</th>
            <th>Type</th>
            <th>Status</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} className="hover">
              <td className="font-medium">{device.name}</td>
              <td className="font-mono text-xs tabular-nums text-base-content/50">{device.imei}</td>
              <td className="text-base-content/70">{device.vehiclePlate || "\u2014"}</td>
              <td className="text-base-content/70 capitalize">{device.vehicleType || "\u2014"}</td>
              <td>
                <div className="flex items-center gap-1.5">
                  <span className={`status ${device.status === "active" ? "status-success" : "status-neutral"}`} />
                  <span className={`text-xs font-medium ${device.status === "active" ? "text-success" : "text-base-content/40"}`}>
                    {device.status}
                  </span>
                </div>
              </td>
              <td>
                <button
                  onClick={() => handleDelete(device.id)}
                  className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-12">
                <Cpu className="w-8 h-8 text-base-content/20 mx-auto mb-3" />
                <p className="text-sm text-base-content/50">No devices yet</p>
                <p className="text-xs text-base-content/30 mt-0.5">Add your first GPS device to start tracking</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
