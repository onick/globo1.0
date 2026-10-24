"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BellOff, Check, CheckCheck, Gauge, LogIn, LogOut, MapPin, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/page-header";
import { useCan } from "@/components/shared/role-provider";

interface Alert {
  id: string;
  type: "geofence_enter" | "geofence_exit" | "overspeed";
  time: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  limitKmh: number | null;
  readAt: string | null;
  device: { id: string; name: string; vehiclePlate: string | null };
  geofence: { id: string; name: string } | null;
  notifications: {
    channel: "email" | "whatsapp";
    address: string;
    status: "pending" | "sent" | "failed";
    attempts: number;
    lastError: string | null;
  }[];
}

const STATUS_BADGES = { sent: "success", pending: "warning", failed: "danger" } as const;

// One badge per notification; the tooltip has the address and, if any, the last error
function Deliveries({ alert }: { alert: Alert }) {
  if (!alert.notifications.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {alert.notifications.map((n, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <Badge variant={STATUS_BADGES[n.status]} className="cursor-default">
              {n.channel === "email" ? "Email" : "WhatsApp"} {n.status}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {n.address}: {n.status}
            {n.attempts > 1 ? ` after ${n.attempts} attempts` : ""}
            {n.lastError ? ` — ${n.lastError}` : ""}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

const TYPE_LABELS: Record<Alert["type"], string> = {
  geofence_enter: "Entered geofence",
  geofence_exit: "Left geofence",
  overspeed: "Speeding",
};

const TYPE_STYLES: Record<Alert["type"], { icon: LucideIcon; variant: "info" | "warning" | "danger" }> = {
  geofence_enter: { icon: LogIn, variant: "info" },
  geofence_exit: { icon: LogOut, variant: "warning" },
  overspeed: { icon: Gauge, variant: "danger" },
};

// Radix Select can't use "" as an item value
const ALL_TYPES = "all";

const REFRESH_MS = 30_000;
// Margin around the alert when opening it on the map
const MAP_MARGIN_MS = 5 * 60000;

function detail(a: Alert) {
  if (a.type === "overspeed") return `${a.speedKmh} km/h (limit ${a.limitKmh})`;
  return a.geofence?.name ?? "Deleted geofence";
}

async function fetchAlerts(type: string, unreadOnly: boolean, deviceId: string | null): Promise<Alert[] | null> {
  const query = new URLSearchParams();
  if (type !== ALL_TYPES) query.set("type", type);
  if (deviceId) query.set("deviceId", deviceId);
  if (unreadOnly) query.set("unread", "1");
  const res = await fetch(`/api/alerts?${query}`);
  return res.ok ? res.json() : null;
}

export function AlertList() {
  // null until the first load
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [type, setType] = useState(ALL_TYPES);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const canAcknowledge = useCan("alerts:acknowledge");
  // ?deviceId= shows one vehicle's alerts, e.g. from its panel on the map
  const deviceId = useSearchParams().get("deviceId");
  const router = useRouter();
  // Bumped to reload right away (e.g. after marking alerts read)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetchAlerts(type, unreadOnly, deviceId).then((list) => {
        if (active && list) setAlerts(list);
      });
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [type, unreadOnly, deviceId, version]);

  async function markRead(ids?: string[]) {
    const res = await fetch("/api/alerts/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    if (res.ok) {
      setVersion((v) => v + 1);
      // Let the header bell refresh its count now instead of at its next poll
      window.dispatchEvent(new Event("alerts:read"));
    }
  }

  function mapLink(a: Alert) {
    const t = new Date(a.time).getTime();
    const query = new URLSearchParams({
      history: "1",
      deviceId: a.device.id,
      from: new Date(t - MAP_MARGIN_MS).toISOString(),
      to: new Date(t + MAP_MARGIN_MS).toISOString(),
    });
    return `/map?${query}`;
  }

  const unread = (alerts ?? []).filter((a) => !a.readAt).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alerts"
        description="Geofence entries and exits and speeding, with who was notified"
        actions={
          canAcknowledge && (
            <Button variant="outline" onClick={() => markRead()} disabled={!unread}>
              <CheckCheck />
              Mark all as read
            </Button>
          )
        }
      />

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48" aria-label="Alert type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>All alerts</SelectItem>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="unread-only" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            <Label htmlFor="unread-only" className="text-sm font-normal">
              Unread only
            </Label>
          </div>
          {deviceId && (
            <Badge variant="info" className="gap-1.5 pr-1">
              Vehicle: {alerts?.[0]?.device.name ?? "…"}
              <button onClick={() => router.push("/alerts")} aria-label="Show all vehicles" className="rounded-full hover:bg-blue-100 p-0.5">
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {alerts !== null && (
            <span className="ml-auto text-xs text-muted-foreground">
              {alerts.length} alert{alerts.length === 1 ? "" : "s"}
              {unread ? ` · ${unread} unread` : ""}
            </span>
          )}
        </div>

        {alerts === null ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center">
            <BellOff className="size-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-foreground mt-3">No alerts</p>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadOnly || type !== ALL_TYPES ? "Nothing matches these filters." : "Alerts appear here as vehicles trigger them."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                {["Time", "Vehicle", "Alert", "Detail", "Location", "Notified", ""].map((h, i) => (
                  // Location is the least useful column (the map link shows it): hidden on narrow screens
                  <TableHead key={i} className={`text-xs text-muted-foreground px-4 ${h === "Location" ? "hidden 2xl:table-cell" : ""}`}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => {
                const style = TYPE_STYLES[a.type];
                return (
                  <TableRow key={a.id} className={a.readAt ? "" : "bg-blue-50/50 hover:bg-blue-50"}>
                    <TableCell className="px-4 tabular-nums">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${a.readAt ? "bg-transparent" : "bg-primary"}`}
                          aria-label={a.readAt ? undefined : "Unread"}
                        />
                        {new Date(a.time).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="font-medium text-foreground">{a.device.name}</div>
                      {a.device.vehiclePlate && <div className="text-xs text-muted-foreground">{a.device.vehiclePlate}</div>}
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant={style.variant}>
                        <style.icon />
                        {TYPE_LABELS[a.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4">{detail(a)}</TableCell>
                    <TableCell className="px-4 tabular-nums text-xs text-muted-foreground hidden 2xl:table-cell">
                      {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
                    </TableCell>
                    <TableCell className="px-4">
                      <Deliveries alert={a} />
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm" className="text-primary">
                          <Link href={mapLink(a)}>
                            <MapPin />
                            View on map
                          </Link>
                        </Button>
                        {!a.readAt && canAcknowledge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" onClick={() => markRead([a.id])} aria-label="Mark as read">
                                <Check />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark as read</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
