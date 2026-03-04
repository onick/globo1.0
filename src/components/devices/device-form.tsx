"use client";

import { useState } from "react";
import {
  Loader2,
  Cpu,
  Truck,
  User,
  Save,
} from "lucide-react";

const VEHICLE_TYPES = [
  { value: "", label: "Select type..." },
  { value: "truck", label: "Truck" },
  { value: "van", label: "Van" },
  { value: "car", label: "Car" },
  { value: "pickup", label: "Pickup" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "bus", label: "Bus" },
];

interface DeviceData {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
}

interface DeviceFormProps {
  device?: DeviceData | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function DeviceForm({ device, onSaved, onCancel }: DeviceFormProps) {
  const isEditing = !!device;

  const [name, setName] = useState(device?.name || "");
  const [imei, setImei] = useState(device?.imei || "");
  const [vehiclePlate, setVehiclePlate] = useState(device?.vehiclePlate || "");
  const [vehicleType, setVehicleType] = useState(device?.vehicleType || "");
  const [driverName, setDriverName] = useState(device?.driverName || "");
  const [driverPhone, setDriverPhone] = useState(device?.driverPhone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      name,
      imei,
      vehiclePlate: vehiclePlate || null,
      vehicleType: vehicleType || null,
      driverName: driverName || null,
      driverPhone: driverPhone || null,
    };

    try {
      const url = isEditing ? `/api/devices/${device.id}` : "/api/devices";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to ${isEditing ? "update" : "create"} device`);
        setLoading(false);
        return;
      }

      setLoading(false);
      onSaved();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
    >
      {/* Form header */}
      <div className="px-5 py-3.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
        <h3 className="text-[14px] font-semibold text-[#0F172A]">
          {isEditing ? "Edit Device" : "New Device"}
        </h3>
        <p className="text-[12px] text-[#94A3B8] mt-0.5">
          {isEditing
            ? "Update device information"
            : "Register a new GPS tracking device"}
        </p>
      </div>

      <div className="p-5 space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100">
            <span className="text-[12px] text-red-600">{error}</span>
          </div>
        )}

        {/* ── Device Info Section ── */}
        <div>
          <SectionLabel icon={Cpu} text="Device Information" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <FormField
              label="Device Name"
              required
              placeholder="e.g. Truck SD-01"
              value={name}
              onChange={setName}
            />
            <FormField
              label="IMEI"
              required
              placeholder="15-digit IMEI number"
              value={imei}
              onChange={setImei}
              disabled={isEditing}
              mono
              hint={isEditing ? "IMEI cannot be changed" : undefined}
            />
          </div>
        </div>

        {/* ── Vehicle Info Section ── */}
        <div>
          <SectionLabel icon={Truck} text="Vehicle Information" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-[12px] font-medium text-[#64748B] mb-1">
                Vehicle Type
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] transition-colors"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="License Plate"
              placeholder="e.g. A-123-456"
              value={vehiclePlate}
              onChange={setVehiclePlate}
            />
          </div>
        </div>

        {/* ── Driver Info Section ── */}
        <div>
          <SectionLabel icon={User} text="Driver (Optional)" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <FormField
              label="Driver Name"
              placeholder="e.g. Carlos Méndez"
              value={driverName}
              onChange={setDriverName}
            />
            <FormField
              label="Driver Phone"
              placeholder="e.g. +18095551234"
              value={driverPhone}
              onChange={setDriverPhone}
              type="tel"
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {loading
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
              ? "Save Changes"
              : "Create Device"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Sub-components ── */

function SectionLabel({
  icon: Icon,
  text,
}: {
  icon: typeof Cpu;
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

function FormField({
  label,
  required,
  placeholder,
  value,
  onChange,
  disabled,
  mono,
  hint,
  type = "text",
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  mono?: boolean;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#64748B] mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] transition-colors disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] ${
          mono ? "font-mono" : ""
        }`}
      />
      {hint && (
        <p className="text-[11px] text-[#94A3B8] mt-1">{hint}</p>
      )}
    </div>
  );
}
