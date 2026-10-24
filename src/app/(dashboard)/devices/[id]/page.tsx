"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, History, Loader2, RefreshCw, Server, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { VehicleIcon } from "@/components/shared/vehicle-icon";
import { serverAddress, SIM_CARRIERS, trackerHostKind, trackerModel, TRACKER_MODELS } from "@/lib/trackers";
import { VEHICLE_TYPES } from "@/lib/vehicle-types";
import { DEFAULT_SPEED_LIMIT_KMH } from "@/lib/activity";

interface DeviceDetail {
  id: string;
  name: string;
  imei: string;
  status: "active" | "inactive" | "disabled";
  vehiclePlate: string | null;
  vehicleType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  speedLimitKmh: number | null;
  trackerModel: string | null;
  simNumber: string | null;
  simCarrier: string | null;
  apn: string | null;
  apnUser: string | null;
  apnPassword: string | null;
  serverHost: string | null;
  updatedAt: string;
  tenant: { name: string };
  imeiChanges: { id: string; oldImei: string; newImei: string; reason: string | null; changedBy: string; changedAt: string }[];
  permissions: { edit: boolean; configure: boolean; delete: boolean };
}

const TABS = ["general", "tracker", "commands", "history"];

// Radix Select can't use "" as an item value
const NONE = "none";

async function fetchDevice(id: string): Promise<DeviceDetail | null> {
  const res = await fetch(`/api/devices/${id}`);
  return res.ok ? res.json() : null;
}

async function patchDevice(id: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/devices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return true;
  const data = await res.json().catch(() => ({}));
  toast.error(data.error || "Could not save");
  return false;
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy")
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => copy(text)}>
      <Copy />
      {label}
    </Button>
  );
}

const card = "bg-card border rounded-xl p-5";

/* ── General: the vehicle ─────────────────────────────── */

function GeneralTab({ device, onSaved }: { device: DeviceDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: device.name,
    vehiclePlate: device.vehiclePlate ?? "",
    vehicleType: device.vehicleType ?? NONE,
    driverName: device.driverName ?? "",
    driverPhone: device.driverPhone ?? "",
    speedLimitKmh: device.speedLimitKmh?.toString() ?? "",
    status: device.status,
  });
  const [saving, setSaving] = useState(false);
  const readOnly = !device.permissions.edit;
  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await patchDevice(device.id, {
      name: form.name.trim(),
      vehiclePlate: form.vehiclePlate.trim() || null,
      vehicleType: form.vehicleType === NONE ? null : form.vehicleType,
      driverName: form.driverName.trim() || null,
      driverPhone: form.driverPhone.trim() || null,
      speedLimitKmh: form.speedLimitKmh === "" ? null : Number(form.speedLimitKmh),
      status: form.status,
    });
    setSaving(false);
    if (ok) {
      toast.success("Vehicle saved");
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className={`${card} space-y-5`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Name" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => set("name")(e.target.value)} disabled={readOnly} required />
        </FormField>
        <FormField label="Plate" htmlFor="plate">
          <Input id="plate" value={form.vehiclePlate} onChange={(e) => set("vehiclePlate")(e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Vehicle type" hint="Sets the vehicle's icon on the map">
          <Select value={form.vehicleType} onValueChange={set("vehicleType")} disabled={readOnly}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                <VehicleIcon vehicleType={null} />
                Not set
              </SelectItem>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <VehicleIcon vehicleType={t.value} />
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={form.status} onValueChange={set("status")} disabled={readOnly}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Driver" htmlFor="driver">
          <Input id="driver" value={form.driverName} onChange={(e) => set("driverName")(e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Driver phone" htmlFor="driver-phone">
          <Input id="driver-phone" value={form.driverPhone} onChange={(e) => set("driverPhone")(e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Speed limit (km/h)" htmlFor="speed-limit" hint={`Speeding alerts above it. Empty: ${DEFAULT_SPEED_LIMIT_KMH} km/h`}>
          <Input
            id="speed-limit"
            type="number"
            min={10}
            max={200}
            value={form.speedLimitKmh}
            onChange={(e) => set("speedLimitKmh")(e.target.value)}
            placeholder={String(DEFAULT_SPEED_LIMIT_KMH)}
            disabled={readOnly}
          />
        </FormField>
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="animate-spin" />}
            Save vehicle
          </Button>
        </div>
      )}
    </form>
  );
}

/* ── Tracker & SIM ────────────────────────────────────── */

function ReplaceImeiDialog({ device, onReplaced }: { device: DeviceDetail; onReplaced: () => void }) {
  const [open, setOpen] = useState(false);
  const [imei, setImei] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function replace(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/devices/${device.id}/imei`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: imei.trim(), reason }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Could not replace the IMEI");
      return;
    }
    toast.success("Tracker replaced. The vehicle keeps its history.");
    setOpen(false);
    setImei("");
    setReason("");
    onReplaced();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <RefreshCw />
          Replace tracker
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={replace} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Replace the tracker</DialogTitle>
            <DialogDescription>
              For a new tracker in the same vehicle. Its trips, stops and alerts stay with the vehicle, and the
              change is recorded. The old tracker stops being followed.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Current IMEI">
            <Input value={device.imei} disabled />
          </FormField>
          <FormField label="New IMEI" htmlFor="new-imei" hint="15 digits for most trackers: it's on the label and in the box">
            <Input id="new-imei" value={imei} onChange={(e) => setImei(e.target.value)} autoFocus required />
          </FormField>
          <FormField label="Reason" htmlFor="reason">
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged tracker, upgrade to 4G" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !imei.trim()}>
              {saving && <Loader2 className="animate-spin" />}
              Replace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrackerTab({ device, onSaved }: { device: DeviceDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    trackerModel: device.trackerModel ?? NONE,
    simNumber: device.simNumber ?? "",
    simCarrier: device.simCarrier ?? NONE,
    apn: device.apn ?? "",
    apnUser: device.apnUser ?? "",
    apnPassword: device.apnPassword ?? "",
  });
  const [saving, setSaving] = useState(false);
  const readOnly = !device.permissions.configure;
  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));
  const model = trackerModel(form.trackerModel);
  const address = model ? serverAddress(model, device.serverHost) : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await patchDevice(device.id, {
      ...form,
      trackerModel: form.trackerModel === NONE ? null : form.trackerModel,
      simCarrier: form.simCarrier === NONE ? null : form.simCarrier,
    });
    setSaving(false);
    if (ok) {
      toast.success("Tracker settings saved");
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {readOnly && (
        <Alert>
          <AlertDescription>Only your company&apos;s admins can change the tracker and its SIM.</AlertDescription>
        </Alert>
      )}

      <div className={`${card} space-y-4`}>
        <h2 className="text-sm font-semibold text-foreground">Tracker</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Model">
            <Select value={form.trackerModel} onValueChange={set("trackerModel")} disabled={readOnly}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {TRACKER_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="IMEI">
            <div className="flex gap-2">
              <Input value={device.imei} disabled className="font-mono" />
              {!readOnly && <ReplaceImeiDialog device={device} onReplaced={onSaved} />}
            </div>
          </FormField>
        </div>

        <div className="rounded-lg border bg-muted px-4 py-3 flex flex-wrap items-center gap-3">
          <Server className="size-4 text-muted-foreground" />
          <div className="flex-1 min-w-48">
            <p className="text-xs text-muted-foreground">Server address the tracker must send to</p>
            {address ? (
              <p className="font-mono text-sm text-foreground">{address}</p>
            ) : !model ? (
              <p className="text-sm text-muted-foreground">Choose the model to see it</p>
            ) : (
              <p className="text-sm text-amber-700">
                The server&apos;s public address isn&apos;t configured (TRACKER_SERVER_HOST). Port {model.port}, TCP.
              </p>
            )}
          </div>
          {address && <CopyButton text={address.replace(" (TCP)", "")} />}
        </div>
        {trackerHostKind(device.serverHost) === "ip" && (
          <p className="text-xs text-amber-700">
            The server is set by IP. Best practice is a domain (e.g. trackers.yourcompany.com): if the server ever
            changes, only its DNS record changes instead of sending an SMS to every tracker.
          </p>
        )}
        {trackerHostKind(device.serverHost) === "invalid" && (
          <p className="text-xs text-destructive">
            TRACKER_SERVER_HOST ({device.serverHost}) isn&apos;t a valid domain or IP: trackers can&apos;t reach it.
          </p>
        )}
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="text-sm font-semibold text-foreground">SIM</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="SIM number" htmlFor="sim-number" hint="The setup SMS are sent to this number">
            <Input id="sim-number" value={form.simNumber} onChange={(e) => set("simNumber")(e.target.value)} disabled={readOnly} placeholder="e.g. 809 672 8477" />
          </FormField>
          <FormField label="Carrier">
            <Select value={form.simCarrier} onValueChange={set("simCarrier")} disabled={readOnly}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {SIM_CARRIERS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="APN" htmlFor="apn" hint="The carrier's mobile data APN">
            <Input id="apn" value={form.apn} onChange={(e) => set("apn")(e.target.value)} disabled={readOnly} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="APN user" htmlFor="apn-user" hint="Only if the carrier asks">
              <Input id="apn-user" value={form.apnUser} onChange={(e) => set("apnUser")(e.target.value)} disabled={readOnly} />
            </FormField>
            <FormField label="APN password" htmlFor="apn-password">
              <Input id="apn-password" type="password" value={form.apnPassword} onChange={(e) => set("apnPassword")(e.target.value)} disabled={readOnly} />
            </FormField>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save tracker settings
          </Button>
        </div>
      )}
    </form>
  );
}

/* ── SMS commands ─────────────────────────────────────── */

function CommandsTab({ device }: { device: DeviceDetail }) {
  const model = trackerModel(device.trackerModel);
  if (!model) {
    return (
      <div className={`${card} text-sm text-muted-foreground`}>
        Choose the tracker model in &quot;Tracker &amp; SIM&quot; to see its setup commands.
      </div>
    );
  }
  const commands = model.commands(
    { host: device.serverHost, apn: device.apn, apnUser: device.apnUser, apnPassword: device.apnPassword },
    model.port
  );
  const incomplete = commands.some((c) => c.incomplete);

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-1`}>
        <p className="text-sm text-foreground">{model.howTo}</p>
        {device.simNumber && model.protocol !== "osmand" && (
          <p className="text-sm text-muted-foreground">
            SIM number: <span className="font-mono text-foreground">{device.simNumber}</span>
          </p>
        )}
      </div>
      {incomplete && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <TriangleAlert />
          <AlertDescription className="text-amber-800">
            Some commands have blanks in &lt;angle brackets&gt;: set the APN in &quot;Tracker &amp; SIM&quot;
            {device.serverHost ? "" : " and the server's public address (TRACKER_SERVER_HOST)"} first.
          </AlertDescription>
        </Alert>
      )}
      <div className="bg-card border rounded-xl divide-y">
        {commands.map((c) => (
          <div key={c.label} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="w-48 shrink-0">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.description}</p>
            </div>
            {/* white-space: pre keeps Teltonika's two leading spaces visible */}
            <code className="flex-1 min-w-48 rounded-md bg-muted border px-3 py-2 font-mono text-sm whitespace-pre overflow-x-auto">
              {c.text}
            </code>
            {c.incomplete ? <Badge variant="warning">Incomplete</Badge> : <CopyButton text={c.text} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── IMEI history ─────────────────────────────────────── */

function HistoryTab({ device }: { device: DeviceDetail }) {
  if (!device.imeiChanges.length) {
    return (
      <div className={`${card} py-12 text-center`}>
        <History className="size-10 text-slate-300 mx-auto" />
        <p className="text-sm text-muted-foreground mt-3">This vehicle has always had the same tracker.</p>
      </div>
    );
  }
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            {["Date", "Old IMEI", "New IMEI", "Reason", "By"].map((h) => (
              <TableHead key={h} className="text-xs text-muted-foreground px-4">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {device.imeiChanges.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="px-4 tabular-nums">{new Date(c.changedAt).toLocaleString()}</TableCell>
              <TableCell className="px-4 font-mono text-muted-foreground">{c.oldImei}</TableCell>
              <TableCell className="px-4 font-mono">{c.newImei}</TableCell>
              <TableCell className="px-4">{c.reason ?? "—"}</TableCell>
              <TableCell className="px-4 text-muted-foreground">{c.changedBy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Bumped to reload after saving. The forms remount when the saved device arrives (keyed
  // by updatedAt), and the tab stays
  const [version, setVersion] = useState(0);
  // ?tab=commands opens straight on a tab, e.g. after adding the device
  const requestedTab = useSearchParams().get("tab");
  const [tab, setTab] = useState(TABS.includes(requestedTab ?? "") ? requestedTab! : "general");

  useEffect(() => {
    let active = true;
    fetchDevice(id).then((data) => {
      if (!active) return;
      if (data) setDevice(data);
      else setNotFound(true);
    });
    return () => {
      active = false;
    };
  }, [id, version]);

  const reload = () => setVersion((v) => v + 1);
  const back = (
    <Button asChild variant="outline">
      <Link href="/devices">
        <ArrowLeft />
        Devices
      </Link>
    </Button>
  );

  if (notFound) {
    return (
      <div className="space-y-5">
        <PageHeader title="Device not found" description="It doesn't exist or belongs to another company." actions={back} />
      </div>
    );
  }
  if (!device) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const model = trackerModel(device.trackerModel);
  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title={device.name}
        description={[device.vehiclePlate, `IMEI ${device.imei}`, model?.name, device.tenant.name].filter(Boolean).join(" · ")}
        actions={back}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tracker">Tracker &amp; SIM</TabsTrigger>
          <TabsTrigger value="commands">SMS commands</TabsTrigger>
          <TabsTrigger value="history">
            IMEI history
            {device.imeiChanges.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {device.imeiChanges.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <GeneralTab key={device.updatedAt} device={device} onSaved={reload} />
        </TabsContent>
        <TabsContent value="tracker" className="mt-4">
          <TrackerTab key={device.updatedAt} device={device} onSaved={reload} />
        </TabsContent>
        <TabsContent value="commands" className="mt-4">
          <CommandsTab device={device} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab device={device} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
