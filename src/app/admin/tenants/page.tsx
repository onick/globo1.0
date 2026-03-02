"use client";

import { useEffect, useState } from "react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  maxDevices: number;
  createdAt: string;
  _count: { devices: number; users: number };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((res) => res.json())
      .then(setTenants);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tenants</h1>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Slug</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Devices</th>
              <th className="text-left p-3 font-medium">Users</th>
              <th className="text-left p-3 font-medium">Max Devices</th>
              <th className="text-left p-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{tenant.name}</td>
                <td className="p-3 text-zinc-500">{tenant.slug}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      tenant.status === "active"
                        ? "bg-green-100 text-green-700"
                        : tenant.status === "trial"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {tenant.status}
                  </span>
                </td>
                <td className="p-3">{tenant._count.devices}</td>
                <td className="p-3">{tenant._count.users}</td>
                <td className="p-3">{tenant.maxDevices}</td>
                <td className="p-3 text-zinc-500">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  No tenants registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
