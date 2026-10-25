"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Cpu, Download, Map as MapIcon, MapPin, Pencil, Plus, Search, Settings2, SignalHigh, SignalLow, SignalZero, Trash2 } from "lucide-react";
import { DeviceForm } from "@/components/admin/device-form";
import { usePageResetOn } from "@/hooks/usePageResetOn";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Connection } from "@/lib/connection";

interface Device {
  id: string;
  name: string;
  imei: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  status: string;
  createdAt: string;
  trackerModel: string | null;
  trackerModelName: string | null;
  simNumber: string | null;
  simCarrier: string | null;
  connection: Connection;
  lastReport: string | null;
  tenant: { id: string; name: string } | null;
}

interface Stats {
  total: number;
  online: number;
  offline: number;
  never: number;
  disabled: number;
}

const PAGE_SIZE = 25;

const CONNECTION = {
  online: { label: "Online", variant: "success" },
  offline: { label: "No signal", variant: "warning" },
  never: { label: "Never reported", variant: "secondary" },
} as const;

function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d < 60 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function downloadCsv(rows: Device[]) {
  const header = ["Name", "Plate", "IMEI", "Client", "Tracker", "SIM", "Carrier", "Connection", "Last report", "Status"];
  const cell = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((d) =>
    [d.name, d.vehiclePlate, d.imei, d.tenant?.name ?? null, d.trackerModelName, d.simNumber, d.simCarrier, CONNECTION[d.connection].label, d.lastReport, d.status]
      .map(cell)
      .join(",")
  );
  const url = URL.createObjectURL(new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `devices-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDevicesPage() {
  return (
    <Suspense>
      <AdminDevices />
    </Suspense>
  );
}

function AdminDevices() {
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, online: 0, offline: 0, never: 0, disabled: 0 });
  const [search, setSearch] = useState("");
  // ?tenant=<id> opens the list filtered to one client (from the clients page)
  const [tenantFilter, setTenantFilter] = useState(searchParams.get("tenant") ?? "all");
  const [connectionFilter, setConnectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = usePageResetOn(JSON.stringify([search, tenantFilter, connectionFilter, statusFilter]));
  const [editing, setEditing] = useState<Device | undefined>();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const fetchDevices = useCallback(() => {
    fetch("/api/admin/devices")
      .then((res) => res.json())
      .then((data) => {
        setDevices(data.devices);
        setTenants(data.tenants);
        setStats(data.stats);
      });
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  function openForm(device?: Device) {
    setEditing(device);
    dialogRef.current?.showModal();
  }

  async function handleDelete(device: Device) {
    const res = await fetch(`/api/admin/devices/${device.id}`, { method: "DELETE" });
    if (res.ok) fetchDevices();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (devices ?? []).filter(
      (d) =>
        (!q ||
          [d.name, d.imei, d.vehiclePlate, d.simNumber].some((v) => v?.toLowerCase().includes(q))) &&
        (tenantFilter === "all" || d.tenant?.id === tenantFilter) &&
        (connectionFilter === "all" || d.connection === connectionFilter) &&
        (statusFilter === "all" || d.status === statusFilter)
    );
  }, [devices, search, tenantFilter, connectionFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pct = (n: number) => (stats.total ? `${Math.round((n / stats.total) * 100)}%` : undefined);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Devices"
        description="Every client's GPS devices"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/map">
                <MapIcon /> Live map
              </Link>
            </Button>
            <Button variant="outline" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>
              <Download /> Export CSV
            </Button>
            <Button onClick={() => openForm()}>
              <Plus /> Add device
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Cpu} label="Devices" value={stats.total} detail={`${tenants.length} clients`} />
        <StatCard icon={SignalHigh} label="Online" value={stats.online} detail={pct(stats.online)} tone="green" />
        <StatCard icon={SignalLow} label="No signal" value={stats.offline} detail={pct(stats.offline)} tone="amber" />
        <StatCard icon={SignalZero} label="Never reported" value={stats.never} detail={pct(stats.never)} tone="slate" />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Name, IMEI, plate or SIM…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={connectionFilter} onValueChange={setConnectionFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any connection</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">No signal</SelectItem>
              <SelectItem value="never">Never reported</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Vehicle</TableHead>
              <TableHead>IMEI</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Tracker &amp; SIM</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="pl-4">
                  <Link href={`/devices/${d.id}`} className="font-medium hover:text-primary hover:underline">
                    {d.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{[d.vehiclePlate, d.vehicleType].filter(Boolean).join(" · ") || "—"}</p>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">{d.imei}</TableCell>
                <TableCell>
                  {d.tenant ? (
                    <button className="hover:text-primary hover:underline" onClick={() => setTenantFilter(d.tenant!.id)}>
                      {d.tenant.name}
                    </button>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm">{d.trackerModelName ?? <span className="text-muted-foreground">No model</span>}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {d.simNumber ? [d.simNumber, d.simCarrier].filter(Boolean).join(" · ") : "No SIM"}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={CONNECTION[d.connection].variant}>{CONNECTION[d.connection].label}</Badge>
                  {d.lastReport && <p className="text-xs text-muted-foreground mt-0.5">{ago(d.lastReport)}</p>}
                </TableCell>
                <TableCell className="capitalize text-sm">{d.status}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7" title="Show on the map" asChild disabled={d.connection === "never"}>
                      <Link href={`/map?device=${d.id}`}>
                        <MapPin className="size-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" title="Tracker, SIM and setup" asChild>
                      <Link href={`/devices/${d.id}`}>
                        <Settings2 className="size-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" title="Quick edit (and move to another client)" onClick={() => openForm(d)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" title="Delete">
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                      title={`Delete ${d.name}?`}
                      description="The vehicle and its registration on the tracker server are removed; its tracker stops showing up in Globo."
                      onConfirm={() => handleDelete(d)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {devices && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {devices.length === 0 ? "No devices yet" : "No devices match your filters"}
                </TableCell>
              </TableRow>
            )}
            {!devices && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Loading devices…
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} devices
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-semibold text-lg mb-4">{editing ? "Edit device" : "New device"}</h3>
          <DeviceForm
            key={editing?.id ?? "new"}
            device={editing}
            onSaved={() => {
              dialogRef.current?.close();
              fetchDevices();
            }}
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
