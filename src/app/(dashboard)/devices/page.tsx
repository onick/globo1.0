"use client";

import { useEffect, useState } from "react";
import { DeviceTable } from "@/components/devices/device-table";
import { DeviceForm } from "@/components/devices/device-form";
import { Plus, X } from "lucide-react";

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [showForm, setShowForm] = useState(false);

  async function loadDevices() {
    const res = await fetch("/api/devices");
    if (res.ok) setDevices(await res.json());
  }

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-base-content">Devices</h1>
          <p className="text-sm text-base-content/50 mt-0.5">Manage your GPS tracking devices</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary btn-sm"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Device"}
        </button>
      </div>

      {showForm && (
        <DeviceForm
          onCreated={() => {
            loadDevices();
            setShowForm(false);
          }}
        />
      )}

      <DeviceTable devices={devices} />
    </div>
  );
}
