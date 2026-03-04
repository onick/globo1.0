"use client";

import { useEffect, useState, useCallback } from "react";
import { DeviceTable } from "@/components/devices/device-table";
import { DeviceForm } from "@/components/devices/device-form";
import {
  Plus,
  X,
  Cpu,
  Radio,
  CircleDot,
  CircleOff,
  Search,
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
  createdAt: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [search, setSearch] = useState("");

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) setDevices(await res.json());
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Stats
  const stats = {
    total: devices.length,
    active: devices.filter((d) => d.status === "active").length,
    inactive: devices.filter((d) => d.status === "inactive").length,
    disabled: devices.filter((d) => d.status === "disabled").length,
  };

  // Filtered
  const filtered = search.trim()
    ? devices.filter((d) => {
        const q = search.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          d.imei.includes(q) ||
          (d.vehiclePlate && d.vehiclePlate.toLowerCase().includes(q)) ||
          (d.driverName && d.driverName.toLowerCase().includes(q))
        );
      })
    : devices;

  function handleEdit(device: Device) {
    setEditingDevice(device);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingDevice(null);
  }

  function handleSaved() {
    loadDevices();
    handleCloseForm();
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0F172A]">
            Devices
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Manage your GPS tracking devices
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              handleCloseForm();
            } else {
              setEditingDevice(null);
              setShowForm(true);
            }
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
            showForm
              ? "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
              : "bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm"
          }`}
        >
          {showForm ? (
            <X className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {showForm ? "Cancel" : "Add Device"}
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          icon={Cpu}
          label="Total"
          value={stats.total}
          color="#2563EB"
        />
        <StatCard
          icon={Radio}
          label="Active"
          value={stats.active}
          color="#16A34A"
        />
        <StatCard
          icon={CircleDot}
          label="Inactive"
          value={stats.inactive}
          color="#F59E0B"
        />
        <StatCard
          icon={CircleOff}
          label="Disabled"
          value={stats.disabled}
          color="#EF4444"
        />
      </div>

      {/* ── Form (collapsible) ── */}
      {showForm && (
        <DeviceForm
          device={editingDevice}
          onSaved={handleSaved}
          onCancel={handleCloseForm}
        />
      )}

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Search by name, IMEI, plate, driver..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] transition-colors"
        />
      </div>

      {/* ── Table ── */}
      <DeviceTable
        devices={filtered}
        loading={loading}
        onEdit={handleEdit}
        onDeleted={loadDevices}
      />
    </div>
  );
}

/* ── StatCard ── */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3.5 flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}10` }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <div>
        <p className="text-[20px] font-bold text-[#0F172A] leading-none">
          {value}
        </p>
        <p className="text-[11px] text-[#94A3B8] font-medium mt-0.5">
          {label}
        </p>
      </div>
    </div>
  );
}
