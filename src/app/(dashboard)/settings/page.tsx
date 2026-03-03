"use client";

import { useState, useEffect, FormEvent } from "react";
import { User, Building2, Lock, Loader2, Check, AlertCircle, Shield, Cpu, Users } from "lucide-react";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  status: string;
  maxDevices: number;
  createdAt: string;
  canEdit: boolean;
  _count: { devices: number; users: number };
}

type Status = "idle" | "loading" | "success" | "error";

/* ─── Shared ─── */

function StatusMessage({ status, message }: { status: Status; message: string }) {
  if (status === "idle" || status === "loading") return null;
  return (
    <div className={`flex items-center gap-2 text-xs ${status === "success" ? "text-success" : "text-error"}`}>
      {status === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-base-content/5">
      <div className="w-8 h-8 bg-base-200 rounded-md flex items-center justify-center">
        <Icon className="w-4 h-4 text-base-content/50" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-base-content">{title}</h2>
        <p className="text-xs text-base-content/50">{description}</p>
      </div>
    </div>
  );
}

/* ─── Profile ─── */

function ProfileSection() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.id) {
          setProfile(data);
          setName(data.name);
          setEmail(data.email);
        }
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data);
      setStatus("success");
      setMessage("Profile updated");
    } else {
      setStatus("error");
      setMessage(data.error || "Failed to update");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }

  if (!profile) return <SectionSkeleton />;

  const roleLabel = (profile.role || "").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="card bg-base-100 border border-base-content/5">
      <div className="card-body">
        <SectionHeader icon={User} title="Profile" description="Your personal information" />
        <form onSubmit={handleSubmit} className="space-y-3">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Name</legend>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input input-bordered w-full" required />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Email</legend>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input input-bordered w-full" required />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Role</legend>
            <div className="flex items-center gap-2">
              <input type="text" value={roleLabel} disabled className="input input-bordered w-full" />
              {profile.role === "super_admin" && <Shield className="w-4 h-4 text-warning shrink-0" />}
            </div>
          </fieldset>
          <div className="text-xs text-base-content/40">Member since {new Date(profile.createdAt).toLocaleDateString()}</div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={status === "loading"} className="btn btn-primary btn-sm">
              {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
              Save changes
            </button>
            <StatusMessage status={status} message={message} />
          </div>
        </form>
      </div>
    </section>
  );
}

/* ─── Password ─── */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords don't match");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    setStatus("loading");
    const res = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("success");
      setMessage("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setStatus("error");
      setMessage(data.error || "Failed to update");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <section className="card bg-base-100 border border-base-content/5">
      <div className="card-body">
        <SectionHeader icon={Lock} title="Password" description="Change your account password" />
        <form onSubmit={handleSubmit} className="space-y-3">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Current password</legend>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input input-bordered w-full"
              required
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">New password</legend>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input input-bordered w-full" minLength={6} required />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Confirm password</legend>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input input-bordered w-full" minLength={6} required />
          </fieldset>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={status === "loading"} className="btn btn-primary btn-sm">
              {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
            <StatusMessage status={status} message={message} />
          </div>
        </form>
      </div>
    </section>
  );
}

/* ─── Company ─── */

function CompanySection() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/settings/company")
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) { setCompany(data); setCompanyName(data.name); }
      });
  }, []);

  if (notFound) return null;
  if (!company) return <SectionSkeleton />;

  const statusMap: Record<string, string> = {
    active: "status-success",
    trial: "status-warning",
    suspended: "status-error",
  };

  const statusTextMap: Record<string, string> = {
    active: "text-success",
    trial: "text-warning",
    suspended: "text-error",
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/settings/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: companyName }),
    });
    const data = await res.json();
    if (res.ok) {
      setCompany((prev) => prev && { ...prev, ...data });
      setStatus("success");
      setMessage("Company updated");
    } else {
      setStatus("error");
      setMessage(data.error || "Failed to update");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <section className="card bg-base-100 border border-base-content/5">
      <div className="card-body">
        <SectionHeader icon={Building2} title="Company" description="Your organization settings" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Company name</legend>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!company.canEdit} className="input input-bordered w-full" required />
            </fieldset>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Slug</legend>
              <input type="text" value={company.slug} disabled className="input input-bordered w-full" />
            </fieldset>
          </div>

          {/* Stats — using daisyUI stat component */}
          <div className="stats stats-vertical md:stats-horizontal border border-base-content/5 w-full">
            <div className="stat py-3 px-4">
              <div className="stat-title text-xs">Status</div>
              <div className="stat-value text-sm">
                <div className="flex items-center gap-2">
                  <span className={`status ${statusMap[company.status] || "status-success"}`} />
                  <span className={`capitalize ${statusTextMap[company.status] || "text-success"}`}>{company.status}</span>
                </div>
              </div>
            </div>
            <div className="stat py-3 px-4">
              <div className="stat-figure text-base-content/30"><Cpu className="w-5 h-5" /></div>
              <div className="stat-title text-xs">Devices</div>
              <div className="stat-value text-lg tabular-nums">{company._count.devices}<span className="text-xs text-base-content/40 font-normal ml-1">/ {company.maxDevices}</span></div>
            </div>
            <div className="stat py-3 px-4">
              <div className="stat-figure text-base-content/30"><Users className="w-5 h-5" /></div>
              <div className="stat-title text-xs">Users</div>
              <div className="stat-value text-lg tabular-nums">{company._count.users}</div>
            </div>
            <div className="stat py-3 px-4">
              <div className="stat-title text-xs">Created</div>
              <div className="stat-value text-sm font-medium">{new Date(company.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          {company.canEdit && (
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={status === "loading"} className="btn btn-primary btn-sm">
                {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                Save changes
              </button>
              <StatusMessage status={status} message={message} />
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

/* ─── Shared ─── */

function SectionSkeleton() {
  return (
    <section className="card bg-base-100 border border-base-content/5">
      <div className="card-body animate-pulse">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-base-content/5">
          <div className="skeleton w-8 h-8 rounded-md" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-3 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-9 rounded-md" />
          <div className="skeleton h-9 rounded-md" />
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─── */

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-base-content">Settings</h1>
        <p className="text-sm text-base-content/50 mt-1">Manage your account and organization</p>
      </div>
      {/* Profile + Password side by side */}
      <div className="grid grid-cols-2 gap-6">
        <ProfileSection />
        <PasswordSection />
      </div>
      <CompanySection />
    </div>
  );
}
