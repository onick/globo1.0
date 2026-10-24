"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Cpu,
  Truck,
  User,
  Save,
  Radio,
  Server,
} from "lucide-react";
import { VEHICLE_TYPES as TYPES } from "@/lib/vehicle-types";
import { serverAddress, SIM_CARRIERS, trackerModel, TRACKER_MODELS } from "@/lib/trackers";
import { useCan } from "@/components/shared/role-provider";

const VEHICLE_TYPES = [{ value: "", label: "Select type..." }, ...TYPES];

interface DeviceData {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  speedLimitKmh: number | null;
}

// Overspeed alerts use this when the vehicle has no limit of its own
const DEFAULT_SPEED_LIMIT_KMH = 80;

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
  const [speedLimit, setSpeedLimit] = useState(device?.speedLimitKmh?.toString() || "");
  // Tracker and SIM, asked when adding a device; afterwards they're on the device's page
  const [model, setModel] = useState("");
  const [simNumber, setSimNumber] = useState("");
  const [simCarrier, setSimCarrier] = useState("");
  const [apn, setApn] = useState("");
  const [serverHost, setServerHost] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const canConfigure = useCan("vehicles:configure");
  const askTracker = !isEditing && canConfigure;
  const selectedModel = trackerModel(model);

  useEffect(() => {
    if (!askTracker) return;
    let active = true;
    fetch("/api/tracker-server")
      .then((res) => (res.ok ? res.json() : { host: null }))
      .then((data: { host: string | null }) => {
        if (active) setServerHost(data.host);
      });
    return () => {
      active = false;
    };
  }, [askTracker]);

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
      speedLimitKmh: speedLimit.trim() === "" ? null : Number(speedLimit),
      ...(askTracker && {
        trackerModel: model || null,
        simNumber: simNumber || null,
        simCarrier: simCarrier || null,
        apn: apn || null,
      }),
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
      // With a model, the next step is configuring the tracker: its page has the SMS
      if (!isEditing && model) {
        const created = await res.json();
        router.push(`/devices/${created.id}?tab=commands`);
        return;
      }
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
            <FormField
              label="Speed Limit (km/h)"
              placeholder={`${DEFAULT_SPEED_LIMIT_KMH} (default)`}
              value={speedLimit}
              onChange={setSpeedLimit}
              type="number"
              hint="Overspeed alerts above this. Empty uses the default."
            />
          </div>
        </div>

        {/* ── Tracker & SIM Section (new devices) ── */}
        {askTracker && (
          <div>
            <SectionLabel icon={Radio} text="GPS Tracker & SIM" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <SelectField
                label="Tracker Model"
                value={model}
                onChange={setModel}
                options={[{ value: "", label: "Select model..." }, ...TRACKER_MODELS.map((m) => ({ value: m.id, label: m.name }))]}
                hint="The device type in other platforms (GT06N, GT06E, Coban 303F…)"
              />
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 flex items-start gap-2">
                <Server className="w-3.5 h-3.5 text-[#94A3B8] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[#94A3B8]">Server address for the tracker</p>
                  {!selectedModel ? (
                    <p className="text-[12px] text-[#64748B]">Choose the model to see it</p>
                  ) : serverHost ? (
                    <p className="text-[13px] font-mono text-[#0F172A] break-all">{serverAddress(selectedModel, serverHost)}</p>
                  ) : (
                    <p className="text-[12px] text-amber-700">
                      Port {selectedModel.port} (TCP). The server&apos;s public address isn&apos;t configured yet (TRACKER_SERVER_HOST).
                    </p>
                  )}
                </div>
              </div>
              <FormField
                label="SIM Number"
                placeholder="e.g. 809 672 8477"
                value={simNumber}
                onChange={setSimNumber}
                type="tel"
                hint="The setup SMS are sent to this number"
              />
              <SelectField
                label="Carrier"
                value={simCarrier}
                onChange={setSimCarrier}
                options={[{ value: "", label: "Select carrier..." }, ...SIM_CARRIERS.map((c) => ({ value: c, label: c }))]}
              />
              <FormField
                label="APN"
                placeholder="The carrier's mobile data APN"
                value={apn}
                onChange={setApn}
                hint="APN user and password, if any, go on the device's page"
              />
            </div>
          </div>
        )}

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
              : model
              ? "Create and configure"
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

function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#64748B] mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-[13px] bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-[11px] text-[#94A3B8] mt-1">{hint}</p>}
    </div>
  );
}
