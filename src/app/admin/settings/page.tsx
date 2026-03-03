"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Bell,
  Shield,
  Code,
  TriangleAlert,
  Check,
  Loader2,
  Copy,
  RefreshCw,
  Trash2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

/* ─── Types ─── */

type Tab = "general" | "notifications" | "security" | "api" | "danger";

interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultTimezone: string;
  updateInterval: number;
  dataRetention: number;
  speedUnit: string;
  mapProvider: string;
  defaultMapLat: number;
  defaultMapLng: number;
  defaultZoom: number;
  notifyNewTenant: boolean;
  notifyDeviceOffline: boolean;
  notifyPaymentFailed: boolean;
  notifySystemErrors: boolean;
  notifyWeeklyDigest: boolean;
  offlineThreshold: number;
  speedLimitAlert: number;
  geofenceAlertRadius: number;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  lockoutDuration: number;
  requireTwoFactor: boolean;
  requirePasswordComplexity: boolean;
  allowSelfRegistration: boolean;
  defaultUserRole: string;
  ipWhitelist: string;
  apiKey: string;
  rateLimit: number;
  webhookUrl: string;
  slackConnected: boolean;
  emailSmtpConnected: boolean;
  twilioConnected: boolean;
}

/* ─── Tab Config ─── */

const tabs: { id: Tab; label: string; icon: typeof Settings; danger?: boolean }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "api", label: "API & Integrations", icon: Code },
  { id: "danger", label: "Danger Zone", icon: TriangleAlert, danger: true },
];

/* ─── Shared UI primitives ─── */

const inputCls =
  "w-full h-[38px] rounded-lg border border-[#E2E8F0] bg-white px-[14px] py-[10px] text-[13px] font-normal text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors";

function SettingsCard({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl p-6 flex flex-col gap-5 ${
        danger
          ? "border border-[#FEE2E2] shadow-sm"
          : "shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      }`}
    >
      <div className="flex flex-col gap-1">
        <h3
          className={`text-[15px] font-semibold ${
            danger ? "text-[#DC2626]" : "text-[#0F172A]"
          }`}
        >
          {title}
        </h3>
        <p className="text-[13px] font-normal text-[#64748B]">{description}</p>
      </div>
      <div className={`h-px w-full ${danger ? "bg-[#FEE2E2]" : "bg-[#F1F5F9]"}`} />
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[13px] font-medium text-[#374151]">{children}</label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-normal text-[#94A3B8]">{children}</p>;
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly,
  suffix,
}: {
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  suffix?: string;
}) {
  if (suffix) {
    return (
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          readOnly={readOnly}
        />
        <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8] pointer-events-none">
          {suffix}
        </span>
      </div>
    );
  }
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={inputCls}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} appearance-none pr-9 cursor-pointer`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-[14px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-[#94A3B8] pointer-events-none" />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-[#2563EB]" : "bg-[#E2E8F0]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 mt-0.5 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  borderBottom = true,
  borderTop = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  borderBottom?: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-[14px] ${
        borderBottom ? "border-b border-[#F1F5F9]" : ""
      } ${borderTop ? "border-t border-[#F1F5F9]" : ""}`}
    >
      <div className="flex flex-col gap-0.5 mr-4">
        <p className="text-[13px] font-medium text-[#0F172A]">{title}</p>
        <p className="text-[12px] font-normal text-[#94A3B8]">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ─── General Tab ─── */

function GeneralTab({
  s,
  u,
}: {
  s: PlatformSettings;
  u: (k: keyof PlatformSettings, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title="Platform Information" description="Basic information about the Globo GPS platform">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Platform Name</Label>
            <Input value={s.platformName} onChange={(v) => u("platformName", v)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Support Email</Label>
              <Input value={s.supportEmail} onChange={(v) => u("supportEmail", v)} type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Default Timezone</Label>
              <Select
                value={s.defaultTimezone}
                onChange={(v) => u("defaultTimezone", v)}
                options={[
                  { value: "America/Mexico_City", label: "America/Mexico_City (UTC-6)" },
                  { value: "America/New_York", label: "America/New_York (UTC-5)" },
                  { value: "America/Chicago", label: "America/Chicago (UTC-6)" },
                  { value: "America/Denver", label: "America/Denver (UTC-7)" },
                  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8)" },
                  { value: "Europe/London", label: "Europe/London (UTC+0)" },
                  { value: "Europe/Madrid", label: "Europe/Madrid (UTC+1)" },
                  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
                  { value: "UTC", label: "UTC" },
                ]}
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Tracking Defaults" description="Default settings for GPS tracking behavior">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Update Interval (seconds)</Label>
            <Input value={s.updateInterval} onChange={(v) => u("updateInterval", parseInt(v) || 0)} type="number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Data Retention (days)</Label>
            <Input value={s.dataRetention} onChange={(v) => u("dataRetention", parseInt(v) || 0)} type="number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Speed Unit</Label>
            <Select
              value={s.speedUnit}
              onChange={(v) => u("speedUnit", v)}
              options={[
                { value: "km/h", label: "km/h" },
                { value: "mph", label: "mph" },
                { value: "knots", label: "knots" },
              ]}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Map Configuration" description="Map provider and default view settings">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Map Provider</Label>
            <Select
              value={s.mapProvider}
              onChange={(v) => u("mapProvider", v)}
              options={[
                { value: "maplibre", label: "MapLibre (OpenStreetMap)" },
                { value: "mapbox", label: "Mapbox" },
                { value: "google", label: "Google Maps" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default Map Center</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input value={s.defaultMapLat} onChange={(v) => u("defaultMapLat", parseFloat(v) || 0)} type="number" suffix="(lat)" />
              <Input value={s.defaultMapLng} onChange={(v) => u("defaultMapLng", parseFloat(v) || 0)} type="number" suffix="(lng)" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default Zoom Level</Label>
            <Input value={s.defaultZoom} onChange={(v) => u("defaultZoom", parseInt(v) || 0)} type="number" />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ─── Notifications Tab ─── */

function NotificationsTab({
  s,
  u,
}: {
  s: PlatformSettings;
  u: (k: keyof PlatformSettings, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title="Email Notifications" description="Configure which email notifications are sent to administrators">
        <div>
          <ToggleRow title="New tenant registered" description="Receive an email when a new tenant signs up" checked={s.notifyNewTenant} onChange={(v) => u("notifyNewTenant", v)} />
          <ToggleRow title="Device offline alert" description="Alert when a device goes offline for more than the threshold" checked={s.notifyDeviceOffline} onChange={(v) => u("notifyDeviceOffline", v)} />
          <ToggleRow title="Subscription payment failed" description="Notify when a tenant's payment fails or subscription expires" checked={s.notifyPaymentFailed} onChange={(v) => u("notifyPaymentFailed", v)} />
          <ToggleRow title="System errors & alerts" description="Critical system errors and security incidents" checked={s.notifySystemErrors} onChange={(v) => u("notifySystemErrors", v)} />
          <ToggleRow title="Weekly digest report" description="Summary of platform activity sent every Monday" checked={s.notifyWeeklyDigest} onChange={(v) => u("notifyWeeklyDigest", v)} borderBottom={false} />
        </div>
      </SettingsCard>

      <SettingsCard title="Alert Thresholds" description="Set thresholds for triggering automatic alerts">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Device Offline Threshold (minutes)</Label>
            <Input value={s.offlineThreshold} onChange={(v) => u("offlineThreshold", parseInt(v) || 0)} type="number" />
            <Hint>Alert triggers after device is offline for this duration</Hint>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Speed Limit Alert (km/h)</Label>
            <Input value={s.speedLimitAlert} onChange={(v) => u("speedLimitAlert", parseInt(v) || 0)} type="number" />
            <Hint>Notify when any device exceeds this speed</Hint>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Geofence Alert Radius (meters)</Label>
            <Input value={s.geofenceAlertRadius} onChange={(v) => u("geofenceAlertRadius", parseInt(v) || 0)} type="number" />
            <Hint>Default radius for geofence boundary alerts</Hint>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ─── Security Tab ─── */

function SecurityTab({
  s,
  u,
}: {
  s: PlatformSettings;
  u: (k: keyof PlatformSettings, v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title="Authentication" description="Configure login security and session management">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Session Timeout (minutes)</Label>
              <Input value={s.sessionTimeout} onChange={(v) => u("sessionTimeout", parseInt(v) || 0)} type="number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Max Login Attempts</Label>
              <Input value={s.maxLoginAttempts} onChange={(v) => u("maxLoginAttempts", parseInt(v) || 0)} type="number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Password Minimum Length</Label>
              <Input value={s.passwordMinLength} onChange={(v) => u("passwordMinLength", parseInt(v) || 0)} type="number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Lockout Duration (minutes)</Label>
              <Input value={s.lockoutDuration} onChange={(v) => u("lockoutDuration", parseInt(v) || 0)} type="number" />
            </div>
          </div>
          <ToggleRow title="Require Two-Factor Authentication" description="Enforce 2FA for all admin and super admin users" checked={s.requireTwoFactor} onChange={(v) => u("requireTwoFactor", v)} borderTop />
          <ToggleRow title="Require Password Complexity" description="Must include uppercase, lowercase, number, and special character" checked={s.requirePasswordComplexity} onChange={(v) => u("requirePasswordComplexity", v)} borderTop borderBottom={false} />
        </div>
      </SettingsCard>

      <SettingsCard title="Access Control" description="Registration and default permission settings">
        <div className="flex flex-col gap-4">
          <ToggleRow title="Allow Self-Registration" description="Let new tenants sign up without admin invitation" checked={s.allowSelfRegistration} onChange={(v) => u("allowSelfRegistration", v)} />
          <div className="flex flex-col gap-1.5 py-[14px] border-b border-[#F1F5F9]">
            <Label>Default User Role</Label>
            <Select
              value={s.defaultUserRole}
              onChange={(v) => u("defaultUserRole", v)}
              options={[
                { value: "viewer", label: "Viewer" },
                { value: "operator", label: "Operator" },
                { value: "admin", label: "Admin" },
              ]}
            />
            <Hint>Role assigned to newly created users by default</Hint>
          </div>
          <div className="flex flex-col gap-1.5 py-[14px]">
            <Label>IP Whitelist</Label>
            <textarea
              value={s.ipWhitelist}
              onChange={(e) => u("ipWhitelist", e.target.value)}
              rows={3}
              placeholder="10.0.0.0/8"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-[14px] py-[10px] text-[13px] font-normal text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors resize-none"
            />
            <Hint>One CIDR range per line. Leave empty to allow all IPs.</Hint>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ─── API & Integrations Tab ─── */

function ApiTab({
  s,
  u,
}: {
  s: PlatformSettings;
  u: (k: keyof PlatformSettings, v: unknown) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copyApiKey = async () => {
    await navigator.clipboard.writeText(s.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateKey = async () => {
    if (!confirm("This will invalidate the current key immediately. Are you sure?")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/admin/settings/regenerate-key", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        u("apiKey", data.apiKey);
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title="API Configuration" description="Manage API keys and rate limiting for external integrations">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>API Key</Label>
            <div className="flex items-center gap-2.5">
              <input
                type="text"
                value={s.apiKey}
                readOnly
                className="flex-1 h-[38px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-[14px] py-[10px] text-[13px] text-[#64748B] font-mono outline-none"
              />
              <button
                type="button"
                onClick={copyApiKey}
                className="flex items-center gap-2 h-[38px] rounded-lg border border-[#E2E8F0] bg-white px-4 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Rate Limit (requests/min)</Label>
              <Input value={s.rateLimit} onChange={(v) => u("rateLimit", parseInt(v) || 0)} type="number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Webhook URL</Label>
              <Input value={s.webhookUrl} onChange={(v) => u("webhookUrl", v)} placeholder="https://hooks.example.com/globo" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-[14px] border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={regenerateKey}
              disabled={regenerating}
              className="flex items-center gap-1.5 h-[34px] rounded-lg border border-[#F59E0B] px-4 text-[13px] font-medium text-[#F59E0B] hover:bg-[#FFFBEB] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
              Regenerate API Key
            </button>
            <Hint>This will invalidate the current key immediately</Hint>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Integrations" description="Connect external services for notifications and data sync">
        <div>
          <IntegrationRow icon="slack" name="Slack" description="Send notifications to Slack channels" connected={s.slackConnected} border />
          <IntegrationRow icon="email" name="Email SMTP" description="Custom SMTP server for notification delivery" connected={s.emailSmtpConnected} border />
          <IntegrationRow icon="twilio" name="Twilio SMS" description="Send SMS alerts for critical events" connected={s.twilioConnected} border={false} />
        </div>
      </SettingsCard>
    </div>
  );
}

function IntegrationRow({
  icon,
  name,
  description,
  connected,
  border,
}: {
  icon: string;
  name: string;
  description: string;
  connected: boolean;
  border: boolean;
}) {
  const colors: Record<string, string> = {
    slack: "bg-[#F3E8FF] text-[#7C3AED]",
    email: "bg-[#DBEAFE] text-[#2563EB]",
    twilio: "bg-[#FEE2E2] text-[#DC2626]",
  };
  const letters: Record<string, string> = { slack: "S", email: "E", twilio: "T" };

  return (
    <div className={`flex items-center justify-between py-4 ${border ? "border-b border-[#F1F5F9]" : ""}`}>
      <div className="flex items-center gap-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${colors[icon]}`}>
          {letters[icon]}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[13px] font-medium text-[#0F172A]">{name}</p>
          <p className="text-[12px] font-normal text-[#94A3B8]">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {connected ? (
          <>
            <span className="text-[11px] font-medium text-[#16A34A] bg-[#F0FDF4] px-2.5 py-1 rounded-full">Connected</span>
            <button type="button" className="text-[13px] text-[#64748B] hover:text-[#334155] font-medium transition-colors">Configure</button>
          </>
        ) : (
          <>
            <span className="text-[12px] text-[#94A3B8]">Not Connected</span>
            <button type="button" className="text-[13px] text-[#DC2626] font-medium border border-[#FCA5A5] rounded-lg px-3 py-1 hover:bg-[#FEF2F2] transition-colors">Connect</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Danger Zone Tab ─── */

function DangerTab() {
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm("Are you absolutely sure? This will permanently delete all tracking data.")) return;
    setResetting(true);
    setTimeout(() => setResetting(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title="Reset Platform Data" description="Permanently delete all tracking data, device history, and audit logs" danger>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FEF2F2] px-4 py-[14px]">
            <TriangleAlert className="w-[18px] h-[18px] text-[#DC2626] shrink-0 mt-0.5" />
            <p className="text-[12px] font-normal text-[#991B1B] leading-relaxed">
              This action is irreversible. All GPS tracking history, device logs, and audit records will be permanently deleted. Tenant and user accounts will not be affected.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 w-[200px] justify-center rounded-lg bg-[#DC2626] h-[38px] text-[13px] font-semibold text-white hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
          >
            {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Reset All Data
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Delete Platform" description="Permanently delete the entire Globo GPS platform including all tenants, users, and data" danger>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FEF2F2] px-4 py-[14px]">
            <TriangleAlert className="w-[18px] h-[18px] text-[#DC2626] shrink-0 mt-0.5" />
            <p className="text-[12px] font-normal text-[#991B1B] leading-relaxed">
              This will permanently destroy the entire platform. All tenants, users, devices, subscriptions, and data will be irrecoverably deleted. This cannot be undone.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[#374151]">
              Type &quot;DELETE GLOBO GPS&quot; to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full h-[38px] rounded-lg border border-[#FCA5A5] bg-white px-[14px] py-[10px] text-[13px] font-normal text-[#0F172A] outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
            />
          </div>
          <button
            type="button"
            disabled={deleteConfirm !== "DELETE GLOBO GPS"}
            className={`flex items-center gap-2 w-[240px] justify-center rounded-lg h-[38px] text-[13px] font-semibold transition-colors ${
              deleteConfirm === "DELETE GLOBO GPS"
                ? "bg-[#DC2626] text-white hover:bg-[#B91C1C] cursor-pointer"
                : "bg-[#FCA5A5] text-white/50 cursor-not-allowed"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Delete Entire Platform
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ─── Main Page ─── */

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateField = useCallback(
    (key: keyof PlatformSettings, value: unknown) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaveStatus(res.ok ? "success" : "error");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748B] text-[13px]">
        <AlertCircle className="w-5 h-5 mr-2" />
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#0F172A]">Settings</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Platform configuration and preferences</p>
        </div>
        {activeTab !== "danger" && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-[38px] rounded-lg bg-[#2563EB] px-5 text-[13px] font-medium text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Saving..." : saveStatus === "success" ? "Saved!" : "Save Changes"}
          </button>
        )}
      </div>

      {/* Tabs + Content */}
      <div className="flex gap-6">
        {/* Tab nav — gap:4 matches Pencil design */}
        <nav className="w-[200px] shrink-0 flex flex-col gap-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-[14px] py-[10px] text-[13px] text-left transition-all ${
                  active
                    ? tab.danger
                      ? "bg-white border border-[#EF4444] text-[#EF4444] font-semibold shadow-sm"
                      : "bg-white border border-[#2563EB] text-[#2563EB] font-semibold shadow-sm"
                    : tab.danger
                      ? "text-[#EF4444] font-medium hover:bg-white/60 border border-transparent"
                      : "text-[#64748B] font-medium hover:bg-white/60 border border-transparent"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "general" && <GeneralTab s={settings} u={updateField} />}
          {activeTab === "notifications" && <NotificationsTab s={settings} u={updateField} />}
          {activeTab === "security" && <SecurityTab s={settings} u={updateField} />}
          {activeTab === "api" && <ApiTab s={settings} u={updateField} />}
          {activeTab === "danger" && <DangerTab />}
        </div>
      </div>
    </div>
  );
}
