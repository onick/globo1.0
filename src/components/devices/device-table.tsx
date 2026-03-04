"use client";

import {
  Trash2,
  Cpu,
  Pencil,
  Truck,
  Car,
  Bike,
} from "lucide-react";

interface Device {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  traccarId: number | null;
}

const VEHICLE_ICONS: Record<string, typeof Truck> = {
  truck: Truck,
  van: Truck,
  pickup: Car,
  car: Car,
  motorcycle: Bike,
  bus: Truck,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  inactive: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  disabled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

interface DeviceTableProps {
  devices: Device[];
  loading: boolean;
  onEdit: (device: Device) => void;
  onDeleted: () => void;
}

export function DeviceTable({ devices, loading, onEdit, onDeleted }: DeviceTableProps) {
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will also remove it from Traccar.`)) return;
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted();
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[13px] text-[#94A3B8] mt-3">Loading devices...</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
        <Cpu className="w-10 h-10 text-[#E2E8F0] mx-auto mb-3" />
        <p className="text-[14px] font-medium text-[#64748B]">No devices found</p>
        <p className="text-[12px] text-[#94A3B8] mt-1">
          Add your first GPS device to start tracking
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#F1F5F9]">
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Device
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              IMEI
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Vehicle
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Driver
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Status
            </th>
            <th className="w-20 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const VehicleIcon = VEHICLE_ICONS[device.vehicleType || "truck"] || Truck;
            const status = STATUS_STYLES[device.status] || STATUS_STYLES.inactive;

            return (
              <tr
                key={device.id}
                className="border-b border-[#F8FAFC] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
              >
                {/* Device name + plate */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                      <VehicleIcon className="w-4 h-4 text-[#64748B]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#0F172A]">
                        {device.name}
                      </p>
                      {device.vehiclePlate && (
                        <p className="text-[11px] text-[#94A3B8]">
                          {device.vehiclePlate}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* IMEI */}
                <td className="px-4 py-3">
                  <span className="text-[12px] font-mono text-[#64748B] tabular-nums">
                    {device.imei}
                  </span>
                </td>

                {/* Vehicle type */}
                <td className="px-4 py-3">
                  <span className="text-[12px] text-[#64748B] capitalize">
                    {device.vehicleType || "—"}
                  </span>
                </td>

                {/* Driver */}
                <td className="px-4 py-3">
                  {device.driverName ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[9px] font-bold">
                          {device.driverName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#0F172A]">
                          {device.driverName}
                        </p>
                        {device.driverPhone && (
                          <p className="text-[10px] text-[#94A3B8]">
                            {device.driverPhone}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[12px] text-[#CBD5E1] italic">
                      Unassigned
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${status.bg} ${status.text}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                    />
                    {device.status}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => onEdit(device)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                      title="Edit device"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(device.id, device.name)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete device"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
