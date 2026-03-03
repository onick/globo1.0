"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Radio } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      // Check if user is super_admin to redirect to admin panel
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;
      router.push(role === "super_admin" ? "/admin" : "/map");
    }
  }

  return (
    <div>
      {/* Mobile brand */}
      <div className="flex items-center gap-2.5 mb-8 lg:hidden">
        <div className="w-8 h-8 rounded-md bg-success/20 flex items-center justify-center">
          <Radio className="w-4 h-4 text-success" />
        </div>
        <span className="text-base font-semibold tracking-tight text-base-content">Globo GPS</span>
      </div>

      <div className="space-y-1.5 mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-base-content">Sign in</h1>
        <p className="text-sm text-base-content/50">Enter your credentials to access the dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="alert alert-error alert-sm">
            <span className="text-sm">{error}</span>
          </div>
        )}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Email</legend>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input input-bordered w-full"
            placeholder="you@company.com"
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Password</legend>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="input input-bordered w-full"
          />
        </fieldset>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-sm text-center text-base-content/50 pt-2">
          No account?{" "}
          <Link href="/register" className="link link-hover font-medium text-base-content">
            Register your company
          </Link>
        </p>
      </form>
    </div>
  );
}
