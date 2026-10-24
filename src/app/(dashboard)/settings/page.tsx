"use client";

import { useState, useEffect, FormEvent, type ReactNode } from "react";
import { User, Building2, Lock, Loader2, Shield, Cpu, Users, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/shared/form-field";
import { PageHeader } from "@/components/shared/page-header";

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

/* ─── Shared ─── */

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card border rounded-xl">
      <div className="flex items-center gap-3 px-5 py-4 border-b">
        <div className="size-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon className="size-4 text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SubmitButton({ saving, children }: { saving: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={saving}>
      {saving && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/* ─── Profile ─── */

function ProfileSection() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      // The response only has the updated fields: keep the rest (role, createdAt)
      setProfile((prev) => prev && { ...prev, ...data });
      toast.success("Profile updated");
    } else {
      toast.error(data.error || "Could not update the profile");
    }
  }

  if (!profile) return <SectionSkeleton />;

  const roleLabel = (profile.role || "").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Section icon={User} title="Profile" description="Your personal information">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="profile-name">
          <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>
        <FormField label="Email" htmlFor="profile-email">
          <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </FormField>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Role</span>
          <Badge variant={profile.role === "super_admin" ? "warning" : "secondary"}>
            {profile.role === "super_admin" && <Shield />}
            {roleLabel}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </span>
          <SubmitButton saving={saving}>Save changes</SubmitButton>
        </div>
      </form>
    </Section>
  );
}

/* ─── Password ─── */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.error(data.error || "Could not update the password");
    }
  }

  return (
    <Section icon={Lock} title="Password" description="Change your account password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Current password" htmlFor="current-password">
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </FormField>
        <FormField label="New password" htmlFor="new-password" hint="At least 6 characters">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
        </FormField>
        <FormField
          label="Confirm password"
          htmlFor="confirm-password"
          hint={mismatch ? <span className="text-destructive">Passwords don&apos;t match</span> : undefined}
        >
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={mismatch}
            minLength={6}
            required
          />
        </FormField>
        <div className="flex justify-end pt-1">
          <SubmitButton saving={saving}>Update password</SubmitButton>
        </div>
      </form>
    </Section>
  );
}

/* ─── Company ─── */

const COMPANY_STATUS = { active: "success", trial: "warning", suspended: "danger" } as const;

function CompanyStat({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-foreground tabular-nums">{children}</div>
    </div>
  );
}

function CompanySection() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: companyName }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setCompany((prev) => prev && { ...prev, ...data });
      toast.success("Company updated");
    } else {
      toast.error(data.error || "Could not update the company");
    }
  }

  const statusVariant = COMPANY_STATUS[company.status as keyof typeof COMPANY_STATUS] ?? "secondary";

  return (
    <Section icon={Building2} title="Company" description="Your organization settings">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Company name" htmlFor="company-name">
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!company.canEdit}
              required
            />
          </FormField>
          <FormField label="Slug" htmlFor="company-slug" hint="Used in links; can't be changed">
            <Input id="company-slug" value={company.slug} disabled />
          </FormField>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CompanyStat icon={Shield} label="Status">
            <Badge variant={statusVariant} className="capitalize">
              {company.status}
            </Badge>
          </CompanyStat>
          <CompanyStat icon={Cpu} label="Devices">
            {company._count.devices}
            <span className="text-xs text-muted-foreground font-normal ml-1">/ {company.maxDevices}</span>
          </CompanyStat>
          <CompanyStat icon={Users} label="Users">
            {company._count.users}
          </CompanyStat>
          <CompanyStat icon={CalendarDays} label="Created">
            <span className="text-sm">{new Date(company.createdAt).toLocaleDateString()}</span>
          </CompanyStat>
        </div>

        {company.canEdit && (
          <div className="flex justify-end">
            <SubmitButton saving={saving}>Save changes</SubmitButton>
          </div>
        )}
      </form>
    </Section>
  );
}

function SectionSkeleton() {
  return (
    <section className="bg-card border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-9" />
      <Skeleton className="h-9" />
    </section>
  );
}

/* ─── Page ─── */

export default function SettingsPage() {
  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title="Settings" description="Manage your account and organization" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <ProfileSection />
        <PasswordSection />
      </div>
      <CompanySection />
    </div>
  );
}
