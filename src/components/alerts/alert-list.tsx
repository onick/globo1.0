"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";

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

const STATUS_STYLES = {
  sent: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
};

// One badge per notification; the tooltip has the address and, if any, the last error
function Deliveries({ alert }: { alert: Alert }) {
  if (!alert.notifications.length) return <span className="text-zinc-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {alert.notifications.map((n, i) => (
        <span
          key={i}
          title={`${n.address}: ${n.status}${n.attempts > 1 ? ` after ${n.attempts} attempts` : ""}${n.lastError ? ` — ${n.lastError}` : ""}`}
          className={`px-1.5 py-0.5 rounded text-xs font-normal ${STATUS_STYLES[n.status]}`}
        >
          {n.channel === "email" ? "Email" : "WhatsApp"} {n.status}
        </span>
      ))}
    </div>
  );
}

const TYPE_LABELS: Record<Alert["type"], string> = {
  geofence_enter: "Entered geofence",
  geofence_exit: "Left geofence",
  overspeed: "Speeding",
};

const REFRESH_MS = 30_000;
// Margin around the alert when opening it on the map
const MAP_MARGIN_MS = 5 * 60000;

function detail(a: Alert) {
  if (a.type === "overspeed") return `${a.speedKmh} km/h (limit ${a.limitKmh})`;
  return a.geofence?.name ?? "Deleted geofence";
}

async function fetchAlerts(type: string, unreadOnly: boolean): Promise<Alert[] | null> {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (unreadOnly) query.set("unread", "1");
  const res = await fetch(`/api/alerts?${query}`);
  return res.ok ? res.json() : null;
}

export function AlertList() {
  // null until the first load
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [type, setType] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Bumped to reload right away (e.g. after marking alerts read)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetchAlerts(type, unreadOnly).then((list) => {
        if (active && list) setAlerts(list);
      });
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [type, unreadOnly, version]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 bg-white border rounded-lg p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              <option value="">All</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
        </div>
        <button
          onClick={() => markRead()}
          disabled={!unread}
          className="px-3 py-2 border rounded-md text-sm hover:bg-zinc-100 disabled:opacity-50"
        >
          Mark all as read
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        {alerts !== null && alerts.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No alerts.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                {["Time", "Vehicle", "Alert", "Detail", "Location", "Sent", ""].map((h) => (
                  <th key={h} className="px-4 py-2 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(alerts ?? []).map((a) => (
                <tr key={a.id} className={`border-t ${a.readAt ? "" : "bg-blue-50/60 font-medium"}`}>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{new Date(a.time).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {a.device.name}
                    {a.device.vehiclePlate ? <span className="text-zinc-500"> · {a.device.vehiclePlate}</span> : null}
                  </td>
                  <td className="px-4 py-2">{TYPE_LABELS[a.type]}</td>
                  <td className="px-4 py-2">{detail(a)}</td>
                  <td className="px-4 py-2 tabular-nums text-zinc-500">
                    {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
                  </td>
                  <td className="px-4 py-2">
                    <Deliveries alert={a} />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                    <Link href={mapLink(a)} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <MapPin className="h-3.5 w-3.5" />
                      View on map
                    </Link>
                    {!a.readAt && (
                      <button onClick={() => markRead([a.id])} className="text-zinc-500 hover:underline">
                        Mark read
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
