"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface Device {
  id: string;
  name: string;
  imei: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  status: string;
  tenant: { id: string; name: string } | null;
}

interface Tenant {
  id: string;
  name: string;
}

export function DeviceForm({
  device,
  onSaved,
  onCancel,
}: {
  device?: Device;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const fetchTenants = useCallback(() => {
    fetch("/api/admin/tenants")
      .then((res) => res.json())
      .then((data) => setTenants(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      imei: formData.get("imei"),
      vehiclePlate: formData.get("vehiclePlate"),
      vehicleType: formData.get("vehicleType"),
      status: formData.get("status"),
      tenantId: formData.get("tenantId"),
    };

    const url = device
      ? `/api/admin/devices/${device.id}`
      : "/api/admin/devices";
    const method = device ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save device");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="alert alert-error alert-sm">
          <span className="text-sm">{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Name</legend>
          <input
            name="name"
            required
            placeholder="e.g. Truck 01"
            className="input input-bordered w-full"
            defaultValue={device?.name ?? ""}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">IMEI</legend>
          <input
            name="imei"
            required
            placeholder="e.g. 359632048123456"
            className="input input-bordered w-full font-mono text-sm"
            defaultValue={device?.imei ?? ""}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Vehicle Plate</legend>
          <input
            name="vehiclePlate"
            placeholder="e.g. ABC-1234"
            className="input input-bordered w-full"
            defaultValue={device?.vehiclePlate ?? ""}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Vehicle Type</legend>
          <select
            name="vehicleType"
            className="select select-bordered w-full"
            defaultValue={device?.vehicleType ?? ""}
          >
            <option value="">Select type</option>
            <option value="Truck">Truck</option>
            <option value="Van">Van</option>
            <option value="Car">Car</option>
            <option value="Motorcycle">Motorcycle</option>
            <option value="Pickup">Pickup</option>
            <option value="Bus">Bus</option>
          </select>
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Status</legend>
          <select
            name="status"
            className="select select-bordered w-full"
            defaultValue={device?.status ?? "active"}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="disabled">Disabled</option>
          </select>
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Tenant</legend>
          <select
            name="tenantId"
            required
            className="select select-bordered w-full"
            defaultValue={device?.tenant?.id ?? ""}
          >
            <option value="" disabled>Select tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </fieldset>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Saving..." : device ? "Update Device" : "Create Device"}
        </button>
      </div>
    </form>
  );
}
