"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  maxDevices: number;
  price: number;
  interval: string;
  features: string[];
  active: boolean;
}

export function PlanForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan?: Plan;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [features, setFeatures] = useState<string[]>(
    plan?.features ?? []
  );
  const [featureInput, setFeatureInput] = useState("");

  function addFeature() {
    const trimmed = featureInput.trim();
    if (trimmed && !features.includes(trimmed)) {
      setFeatures([...features, trimmed]);
      setFeatureInput("");
    }
  }

  function removeFeature(index: number) {
    setFeatures(features.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      maxDevices: Number(formData.get("maxDevices")),
      price: Math.round(Number(formData.get("price")) * 100),
      interval: formData.get("interval"),
      features,
      active: formData.get("active") === "on",
    };

    const url = plan ? `/api/admin/plans/${plan.id}` : "/api/admin/plans";
    const method = plan ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save plan");
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
          <legend className="fieldset-legend">Plan Name</legend>
          <input
            name="name"
            required
            placeholder="e.g. Pro"
            className="input input-bordered w-full"
            defaultValue={plan?.name}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Price (USD)</legend>
          <input
            name="price"
            type="number"
            step="0.01"
            min={0}
            required
            placeholder="49.99"
            className="input input-bordered w-full"
            defaultValue={plan ? (plan.price / 100).toFixed(2) : ""}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Max Devices</legend>
          <input
            name="maxDevices"
            type="number"
            min={1}
            required
            placeholder="50"
            className="input input-bordered w-full"
            defaultValue={plan?.maxDevices ?? 10}
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Billing Interval</legend>
          <select
            name="interval"
            className="select select-bordered w-full"
            defaultValue={plan?.interval ?? "monthly"}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </fieldset>
      </div>

      <fieldset className="fieldset">
        <legend className="fieldset-legend">Features</legend>
        <div className="flex flex-wrap gap-2 mb-2">
          {features.map((f, i) => (
            <span key={i} className="badge badge-sm gap-1">
              {f}
              <button type="button" onClick={() => removeFeature(i)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Add a feature..."
            className="input input-bordered input-sm flex-1"
            value={featureInput}
            onChange={(e) => setFeatureInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFeature();
              }
            }}
          />
          <button
            type="button"
            onClick={addFeature}
            className="btn btn-ghost btn-sm btn-square"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          name="active"
          type="checkbox"
          className="toggle toggle-sm toggle-primary"
          defaultChecked={plan?.active ?? true}
        />
        <span className="text-sm">Active</span>
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Saving..." : plan ? "Update Plan" : "Create Plan"}
        </button>
      </div>
    </form>
  );
}
