"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  Cpu,
  FileText,
  Activity,
  Settings,
  Navigation,
} from "lucide-react";

const mainNav = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "Plans & Billing", href: "/admin/plans", icon: CreditCard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Devices", href: "/admin/devices", icon: Cpu },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
  { name: "System Health", href: "/admin/system-health", icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const settingsActive = isActive("/admin/settings");

  return (
    <aside className="w-[240px] bg-[#0F172A] min-h-screen flex flex-col gap-2 px-3 py-4">
      {/* Logo Area */}
      <div className="flex items-center gap-2.5 px-2 py-3">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Navigation className="w-[18px] h-[18px] text-white" />
        </div>
        <span className="text-[15px] font-bold text-white whitespace-nowrap">
          Globo GPS
        </span>
        <span className="text-[9px] font-bold uppercase bg-[#F59E0B] text-[#0F172A] px-1.5 py-0.5 rounded shrink-0">
          Admin
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10" />

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[#2563EB] text-white font-medium"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-px bg-white/10" />

      {/* Settings */}
      <Link
        href="/admin/settings"
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
          settingsActive
            ? "bg-[#2563EB] text-white font-medium"
            : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
        }`}
      >
        <Settings className="w-5 h-5 shrink-0" />
        Settings
      </Link>

      {/* User Area */}
      <div className="flex items-center gap-2.5 px-2 py-2.5">
        <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center text-[11px] font-bold text-white">
          N
        </div>
        <span className="text-[13px] font-medium text-white/85">
          Super Admin
        </span>
      </div>
    </aside>
  );
}
