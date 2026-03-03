"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant: { id: string; name: string } | null;
}

interface TenantOption {
  id: string;
  name: string;
}

export function UserForm({
  user,
  onSaved,
  onCancel,
}: {
  user?: User;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((res) => res.json())
      .then((data: TenantOption[]) =>
        setTenants(data.map((t) => ({ id: t.id, name: t.name })))
      );
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      tenantId: formData.get("tenantId") || null,
    };

    if (!user) {
      payload.password = formData.get("password");
    }

    const url = user ? `/api/admin/users/${user.id}` : "/api/admin/users";
    const method = user ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save user");
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
            placeholder="Full name"
            className="input input-bordered w-full"
            defaultValue={user?.name}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Email</legend>
          <input
            name="email"
            type="email"
            required
            placeholder="user@example.com"
            className="input input-bordered w-full"
            defaultValue={user?.email}
          />
        </fieldset>
        {!user && (
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Password</legend>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Min 6 characters"
              className="input input-bordered w-full"
            />
          </fieldset>
        )}
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Role</legend>
          <select
            name="role"
            className="select select-bordered w-full"
            defaultValue={user?.role ?? "operator"}
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Tenant</legend>
          <select
            name="tenantId"
            className="select select-bordered w-full"
            defaultValue={user?.tenant?.id ?? ""}
          >
            <option value="">No tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </fieldset>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Saving..." : user ? "Update User" : "Create User"}
        </button>
      </div>
    </form>
  );
}
