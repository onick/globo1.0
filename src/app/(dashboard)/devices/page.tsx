"use client";

import { useEffect, useState } from "react";
import { DeviceTable } from "@/components/devices/device-table";
import { DeviceForm } from "@/components/devices/device-form";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devices</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800"
        >
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
