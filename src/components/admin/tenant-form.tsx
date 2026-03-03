"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  maxDevices: number;
}

export function TenantForm({
  tenant,
  onSaved,
  onCancel,
}: {
  tenant?: Tenant;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(tenant?.name ?? "");
  const [slug, setSlug] = useState(tenant?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched && !tenant) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  }, [name, slugTouched, tenant]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      status: formData.get("status"),
      maxDevices: Number(formData.get("maxDevices")),
    };

    const url = tenant
      ? `/api/admin/tenants/${tenant.id}`
      : "/api/admin/tenants";
    const method = tenant ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save tenant");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="alert alert-error alert-sm">
          <span className="text-sm">{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Name</legend>
          <input
            name="name"
            required
            placeholder="e.g. Acme Corp"
            className="input input-bordered w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Slug</legend>
          <input
            name="slug"
            required
            placeholder="e.g. acme-corp"
            className="input input-bordered w-full font-mono text-sm"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Status</legend>
          <select
            name="status"
            className="select select-bordered w-full"
            defaultValue={tenant?.status ?? "trial"}
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Max Devices</legend>
          <input
            name="maxDevices"
            type="number"
            min={1}
            required
            placeholder="10"
            className="input input-bordered w-full"
            defaultValue={tenant?.maxDevices ?? 10}
          />
        </fieldset>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Saving..." : tenant ? "Update Tenant" : "Create Tenant"}
        </button>
      </div>
    </form>
  );
}
