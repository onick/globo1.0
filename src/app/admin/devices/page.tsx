"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Cpu, Plus, Search, Pencil, Trash2, ChevronDown, Download } from "lucide-react";
import { DeviceForm } from "@/components/admin/device-form";

interface Device {
  id: string;
  name: string;
  imei: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  status: string;
  createdAt: string;
  tenant: { id: string; name: string } | null;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  disabled: number;
  activePct: string;
}

const statusDot: Record<string, string> = {
  active: "bg-[#16A34A]",
  inactive: "bg-[#F59E0B]",
  disabled: "bg-[#EF4444]",
};

const statusTextColor: Record<string, string> = {
  active: "text-[#16A34A]",
  inactive: "text-[#F59E0B]",
  disabled: "text-[#EF4444]",
};

const PAGE_SIZE = 5;

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    inactive: 0,
    disabled: 0,
    activePct: "0",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Device | undefined>();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const fetchDevices = useCallback(() => {
    fetch("/api/admin/devices")
      .then((res) => res.json())
      .then((data) => {
        setDevices(data.devices);
        setStats(data.stats);
      });
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  function openCreate() {
    setEditing(undefined);
    dialogRef.current?.showModal();
  }

  function openEdit(device: Device) {
    setEditing(device);
    dialogRef.current?.showModal();
  }

  function handleSaved() {
    dialogRef.current?.close();
    fetchDevices();
  }

  async function handleDelete(device: Device) {
    if (!confirm(`Delete device "${device.name}"?`)) return;
    const res = await fetch(`/api/admin/devices/${device.id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchDevices();
  }

  const tenantNames = [
    ...new Set(devices.map((d) => d.tenant?.name).filter(Boolean)),
  ] as string[];

  const filtered = devices.filter((d) => {
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.imei.includes(search);
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const matchesTenant =
      tenantFilter === "all" || d.tenant?.name === tenantFilter;
    return matchesSearch && matchesStatus && matchesTenant;
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, tenantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpis = [
    {
      label: "Total Devices",
      value: stats.total,
      sub: "+18 this month",
      subColor: "text-[#16A34A]",
      valueColor: "",
    },
    {
      label: "Active",
      value: stats.active,
      sub: `${stats.activePct}% online`,
      subColor: "text-[#94A3B8]",
      valueColor: "text-[#16A34A]",
    },
    {
      label: "Inactive",
      value: stats.inactive,
      sub: "No signal > 24h",
      subColor: "text-[#94A3B8]",
      valueColor: "text-[#F59E0B]",
    },
    {
      label: "Disabled",
      value: stats.disabled,
      sub: "Manually disabled",
      subColor: "text-[#94A3B8]",
      valueColor: "text-[#EF4444]",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">Devices</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">
            Monitor all GPS devices across tenants
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-[38px] rounded-lg bg-[#2563EB] px-4 text-[13px] font-medium text-white hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <span className="text-[12px] text-[#94A3B8]">{kpi.label}</span>
            <p
              className={`text-[24px] font-bold tracking-tight tabular-nums mt-1 ${kpi.valueColor || "text-[#0F172A]"}`}
            >
              {kpi.value}
            </p>
            <span className={`text-[12px] ${kpi.subColor}`}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Search + Filters */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search by name or IMEI..."
              className="h-[34px] w-[260px] rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="disabled">Disabled</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="h-[34px] appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] cursor-pointer"
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
              >
                <option value="all">All Tenants</option>
                {tenantNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
            <button className="flex items-center gap-1.5 h-[34px] rounded-lg border border-[#E2E8F0] bg-white px-3 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9]">
              {["Name", "IMEI", "Plate", "Type", "Status", "Tenant", "Created", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-[12px] font-medium text-[#94A3B8] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((device) => (
              <tr
                key={device.id}
                className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
              >
                <td className="px-5 py-3 text-[13px] font-medium text-[#0F172A]">
                  {device.name}
                </td>
                <td className="px-5 py-3 text-[12px] font-mono text-[#94A3B8] tabular-nums">
                  {device.imei}
                </td>
                <td className="px-5 py-3 text-[13px] text-[#0F172A]">
                  {device.vehiclePlate || (
                    <span className="text-[#CBD5E1]">&mdash;</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[13px] text-[#0F172A]">
                  {device.vehicleType || (
                    <span className="text-[#CBD5E1]">&mdash;</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${statusDot[device.status] || "bg-[#16A34A]"}`}
                    />
                    <span
                      className={`text-[12px] font-medium capitalize ${statusTextColor[device.status] || "text-[#16A34A]"}`}
                    >
                      {device.status}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[13px] text-[#0F172A]">
                  {device.tenant?.name ?? (
                    <span className="text-[#CBD5E1]">&mdash;</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[12px] text-[#94A3B8]">
                  {new Date(device.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(device)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(device)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <Cpu className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" />
                  <p className="text-[13px] text-[#94A3B8]">
                    {devices.length === 0
                      ? "No devices registered yet"
                      : "No devices match your filters"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F1F5F9]">
            <span className="text-[12px] text-[#94A3B8]">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} devices
            </span>
            <div className="flex items-center gap-1">
              <button
                className="h-[30px] px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`h-[30px] w-[30px] rounded-md text-[12px] transition-colors ${
                      page === p
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="text-[12px] text-[#94A3B8] px-1">...</span>
                  <button
                    className={`h-[30px] w-[30px] rounded-md text-[12px] transition-colors ${
                      page === totalPages
                        ? "bg-[#2563EB] text-white"
                        : "border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                    onClick={() => setPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                className="h-[30px] px-3 rounded-md border border-[#E2E8F0] text-[12px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-semibold text-lg mb-4">
            {editing ? "Edit Device" : "New Device"}
          </h3>
          <DeviceForm
            key={editing?.id ?? "new"}
            device={editing}
            onSaved={handleSaved}
            onCancel={() => dialogRef.current?.close()}
          />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
