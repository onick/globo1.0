"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type Channel = "email" | "whatsapp";
type AlertType = "geofence_enter" | "geofence_exit" | "overspeed";

interface Recipient {
  id: string;
  channel: Channel;
  address: string;
  alertTypes: AlertType[];
  active: boolean;
  tenant: { name: string };
}

interface Tenant {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<AlertType, string> = {
  geofence_enter: "Geofence entry",
  geofence_exit: "Geofence exit",
  overspeed: "Speeding",
};
const ALL_TYPES = Object.keys(TYPE_LABELS) as AlertType[];

const CHANNEL_LABELS: Record<Channel, string> = { email: "Email", whatsapp: "WhatsApp" };

function TypeChecks({ value, onChange }: { value: AlertType[]; onChange: (types: AlertType[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {ALL_TYPES.map((t) => (
        <label key={t} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={value.includes(t)}
            onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))}
          />
          {TYPE_LABELS[t]}
        </label>
      ))}
    </div>
  );
}

export function NotificationSettings({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ email: false, whatsapp: false });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [address, setAddress] = useState("");
  const [types, setTypes] = useState<AlertType[]>(ALL_TYPES);
  const [error, setError] = useState<string | null>(null);

  // Bumped to reload the list after adding a recipient
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/notification-recipients")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { recipients: Recipient[]; channels: Record<Channel, boolean> } | null) => {
        if (!active || !data) return;
        setRecipients(data.recipients);
        setChannels(data.channels);
      });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/admin/tenants")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Tenant[]) => {
          setTenants(data);
          if (data.length) setTenantId(data[0].id);
        });
    }
  }, [isSuperAdmin]);

  async function add() {
    setError(null);
    const res = await fetch("/api/notification-recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, address, alertTypes: types, ...(isSuperAdmin ? { tenantId } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not add the recipient");
      return;
    }
    setAddress("");
    setVersion((v) => v + 1);
  }

  async function update(r: Recipient, data: Partial<Pick<Recipient, "active" | "alertTypes">>) {
    // Keep at least one alert type: an empty list is rejected by the API
    if (data.alertTypes && data.alertTypes.length === 0) return;
    const res = await fetch(`/api/notification-recipients/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) setRecipients((list) => list.map((x) => (x.id === r.id ? { ...x, ...data } : x)));
  }

  async function remove(r: Recipient) {
    if (!confirm(`Stop sending alerts to ${r.address}?`)) return;
    const res = await fetch(`/api/notification-recipients/${r.id}`, { method: "DELETE" });
    if (res.ok) setRecipients((list) => list.filter((x) => x.id !== r.id));
  }

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4 max-w-3xl">
      <div>
        <h2 className="font-semibold">Alert notifications</h2>
        <p className="text-sm text-zinc-500">
          Who gets alerts by email or WhatsApp. Failed sends are retried for about 45 minutes.
        </p>
      </div>

      {(Object.keys(channels) as Channel[])
        .filter((c) => !channels[c])
        .map((c) => (
          <div key={c} className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {CHANNEL_LABELS[c]} isn&apos;t configured on the server: {CHANNEL_LABELS[c]} recipients
            won&apos;t receive anything until it is (see docs/alertas.md).
          </div>
        ))}

      <div className="border rounded-md p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {isSuperAdmin && (
            <label className="flex flex-col gap-1 text-sm">
              Client
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="border rounded-md px-3 py-2 text-sm">
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-56">
            {channel === "email" ? "Email address" : "WhatsApp number (with country code)"}
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={channel === "email" ? "ops@company.com" : "18095551234"}
              className="border rounded-md px-3 py-2 text-sm"
            />
          </label>
        </div>
        <TypeChecks value={types} onChange={setTypes} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          onClick={add}
          disabled={!address.trim() || !types.length}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          Add recipient
        </button>
      </div>

      {recipients.length === 0 ? (
        <p className="text-sm text-zinc-500">No recipients yet.</p>
      ) : (
        <ul className="divide-y border rounded-md">
          {recipients.map((r) => (
            <li key={r.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{r.address}</span>
                  <span className="text-zinc-500">
                    {" "}· {CHANNEL_LABELS[r.channel]}
                    {isSuperAdmin ? ` · ${r.tenant.name}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={r.active} onChange={(e) => update(r, { active: e.target.checked })} />
                    Active
                  </label>
                  <button onClick={() => remove(r)} aria-label={`Delete ${r.address}`} className="p-1.5 rounded hover:bg-zinc-100">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
              <TypeChecks value={r.alertTypes} onChange={(alertTypes) => update(r, { alertTypes })} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
