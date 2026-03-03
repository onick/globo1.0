"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Radio } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        tenantName: formData.get("tenantName"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-8 lg:hidden">
        <div className="w-8 h-8 rounded-md bg-success/20 flex items-center justify-center">
          <Radio className="w-4 h-4 text-success" />
        </div>
        <span className="text-base font-semibold tracking-tight text-base-content">Globo GPS</span>
      </div>

      <div className="space-y-1.5 mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-base-content">Create Account</h1>
        <p className="text-sm text-base-content/50">Register your company on Globo GPS</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="alert alert-error alert-sm">
            <span className="text-sm">{error}</span>
          </div>
        )}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Company Name</legend>
          <input id="tenantName" name="tenantName" required placeholder="e.g. Transportes Lopez" className="input input-bordered w-full" />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Your Name</legend>
          <input id="name" name="name" required className="input input-bordered w-full" />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Email</legend>
          <input id="email" name="email" type="email" required className="input input-bordered w-full" />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Password</legend>
          <input id="password" name="password" type="password" required minLength={8} className="input input-bordered w-full" />
        </fieldset>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Creating..." : "Create Account"}
        </button>

        <p className="text-sm text-center text-base-content/50 pt-2">
          Already have an account?{" "}
          <Link href="/login" className="link link-hover font-medium text-base-content">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
