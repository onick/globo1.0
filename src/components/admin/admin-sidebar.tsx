"use client";

import { useState } from "react";
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
  ChevronLeft,
  ChevronRight,
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
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const settingsActive = isActive("/admin/settings");

  return (
    <aside
      className={`${
        collapsed ? "w-[72px]" : "w-[240px]"
      } bg-[#0F172A] min-h-screen flex flex-col gap-2 px-3 py-4 transition-all duration-200 ease-in-out relative overflow-visible`}
    >
      {/* Collapse toggle — sits on the edge */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 z-50 w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#2563EB] hover:border-[#2563EB] transition-colors shadow-sm"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Logo Area */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-2 py-3`}>
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Navigation className="w-[18px] h-[18px] text-white" />
        </div>
        {!collapsed && (
          <>
            <span className="text-[15px] font-bold text-white whitespace-nowrap">
              Globo GPS
            </span>
            <span className="text-[9px] font-bold uppercase bg-[#F59E0B] text-[#0F172A] px-1.5 py-0.5 rounded shrink-0">
              Admin
            </span>
          </>
        )}
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
              title={collapsed ? item.name : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-[#2563EB] text-white font-medium"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-px bg-white/10" />

      {/* Settings */}
      <Link
        href="/admin/settings"
        title={collapsed ? "Settings" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
          collapsed ? "justify-center" : ""
        } ${
          settingsActive
            ? "bg-[#2563EB] text-white font-medium"
            : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
        }`}
      >
        <Settings className="w-5 h-5 shrink-0" />
        {!collapsed && "Settings"}
      </Link>

      {/* User Area */}
      <div className={`flex items-center gap-2.5 px-2 py-2.5 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-[#EF4444] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          N
        </div>
        {!collapsed && (
          <span className="text-[13px] font-medium text-white/85">
            Super Admin
          </span>
        )}
      </div>
    </aside>
  );
}
