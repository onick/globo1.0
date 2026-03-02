"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded-lg border space-y-4"
    >
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Device Name</Label>
          <Input id="name" name="name" required placeholder="e.g. Truck 01" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imei">IMEI</Label>
          <Input
            id="imei"
            name="imei"
            required
            placeholder="15-digit IMEI"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehiclePlate">License Plate</Label>
          <Input
            id="vehiclePlate"
            name="vehiclePlate"
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicleType">Vehicle Type</Label>
          <Input
            id="vehicleType"
            name="vehicleType"
            placeholder="e.g. truck, car, motorcycle"
          />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add Device"}
      </Button>
    </form>
  );
}
