"use client";

import { useEffect, useId, useState } from "react";
import { BellRing, Mail, MessageCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";
import { useCan } from "@/components/shared/role-provider";

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

const CHANNEL_ICONS = { email: Mail, whatsapp: MessageCircle };

function TypeChecks({
  value,
  onChange,
  disabled = false,
}: {
  value: AlertType[];
  onChange: (types: AlertType[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {ALL_TYPES.map((t) => (
        <div key={t} className="flex items-center gap-2">
          <Checkbox
            id={`${id}-${t}`}
            checked={value.includes(t)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked ? [...value, t] : value.filter((x) => x !== t))}
          />
          <Label htmlFor={`${id}-${t}`} className="text-sm font-normal">
            {TYPE_LABELS[t]}
          </Label>
        </div>
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
  const canManage = useCan("notifications:manage");

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
    toast.success(`${address.trim()} will receive alerts`);
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
    else toast.error("Could not save the change");
  }

  async function remove(r: Recipient) {
    const res = await fetch(`/api/notification-recipients/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      setRecipients((list) => list.filter((x) => x.id !== r.id));
      toast.success(`${r.address} removed`);
    } else {
      toast.error("Could not remove the recipient");
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Who gets alerts by email or WhatsApp. Failed sends are retried for about 45 minutes."
      />

      {(Object.keys(channels) as Channel[])
        .filter((c) => !channels[c])
        .map((c) => (
          <Alert key={c} className="border-amber-200 bg-amber-50 text-amber-900">
            <TriangleAlert />
            <AlertDescription className="text-amber-800">
              {CHANNEL_LABELS[c]} isn&apos;t configured on the server: {CHANNEL_LABELS[c]} recipients won&apos;t
              receive anything until it is (see docs/alertas.md).
            </AlertDescription>
          </Alert>
        ))}

      {!canManage && (
        <Alert>
          <AlertDescription>Only your company&apos;s admins can change who gets alerts.</AlertDescription>
        </Alert>
      )}

      {canManage && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Add recipient</h2>
          <div className="flex flex-wrap items-end gap-3">
            {isSuperAdmin && (
              <FormField label="Client" className="w-48">
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label="Channel" className="w-40">
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <Mail /> Email
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <MessageCircle /> WhatsApp
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label={channel === "email" ? "Email address" : "WhatsApp number (with country code)"}
              htmlFor="recipient-address"
              className="flex-1 min-w-56"
            >
              <Input
                id="recipient-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={channel === "email" ? "ops@company.com" : "18095551234"}
              />
            </FormField>
          </div>
          <FormField label="Alerts to send">
            <TypeChecks value={types} onChange={setTypes} />
          </FormField>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={add} disabled={!address.trim() || !types.length}>
            <Plus />
            Add recipient
          </Button>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm font-semibold text-foreground">Recipients</h2>
          <span className="text-xs text-muted-foreground">{recipients.length}</span>
        </div>
        {recipients.length === 0 ? (
          <div className="py-12 text-center">
            <BellRing className="size-10 text-slate-300 mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">
              No recipients yet.{canManage ? " Add one above." : ""}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {recipients.map((r) => {
              const Icon = CHANNEL_ICONS[r.channel];
              return (
                <li key={r.id} className={`px-5 py-4 space-y-3 ${r.active ? "" : "opacity-60"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.address}</div>
                        <div className="text-xs text-muted-foreground">
                          {CHANNEL_LABELS[r.channel]}
                          {isSuperAdmin ? ` · ${r.tenant.name}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-${r.id}`}
                          checked={r.active}
                          disabled={!canManage}
                          onCheckedChange={(active) => update(r, { active })}
                        />
                        <Label htmlFor={`active-${r.id}`} className="text-sm font-normal">
                          Active
                        </Label>
                      </div>
                      {canManage && (
                        <ConfirmDialog
                          title="Remove recipient?"
                          description={`${r.address} will stop receiving alerts.`}
                          confirmLabel="Remove"
                          onConfirm={() => remove(r)}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.address}`} className="text-muted-foreground hover:text-destructive">
                              <Trash2 />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="pl-11">
                    <TypeChecks value={r.alertTypes} disabled={!canManage} onChange={(alertTypes) => update(r, { alertTypes })} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
