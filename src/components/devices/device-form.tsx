"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function DeviceForm({ onCreated }: { onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        imei: formData.get("imei"),
        vehiclePlate: formData.get("vehiclePlate"),
        vehicleType: formData.get("vehicleType"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create device");
      setLoading(false);
      return;
    }

    (e.target as HTMLFormElement).reset();
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="card bg-base-100 border border-base-content/5">
      <div className="card-body gap-4">
        {error && (
          <div role="alert" className="alert alert-error alert-sm">
            <span className="text-sm">{error}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Device Name</legend>
            <input id="name" name="name" required placeholder="e.g. Truck 01" className="input input-bordered w-full" />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">IMEI</legend>
            <input id="imei" name="imei" required placeholder="15-digit IMEI" className="input input-bordered w-full" />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">License Plate</legend>
            <input id="vehiclePlate" name="vehiclePlate" placeholder="Optional" className="input input-bordered w-full" />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Vehicle Type</legend>
            <input id="vehicleType" name="vehicleType" placeholder="e.g. truck, car, motorcycle" className="input input-bordered w-full" />
          </fieldset>
        </div>
        <div>
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Adding..." : "Add Device"}
          </button>
        </div>
      </div>
    </form>
  );
}
