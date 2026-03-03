import { auth, signOut } from "@/lib/auth";
import { LogOut, Shield, Building2 } from "lucide-react";

export async function Header() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const tenantSlug = user?.tenantSlug;
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="navbar bg-base-100 border-b border-base-300 min-h-12 px-5">
      <div className="flex-1">
        {isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-semibold text-warning uppercase tracking-wide">
              Super Admin
            </span>
          </div>
        ) : tenantSlug ? (
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-base-content/40" />
            <span className="text-sm font-medium text-base-content/70">{tenantSlug}</span>
          </div>
        ) : null}
      </div>
      <div className="flex-none gap-3">
        <span className="text-xs text-base-content/50">{session?.user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="btn btn-ghost btn-xs gap-1.5">
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
