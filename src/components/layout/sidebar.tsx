"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Cpu,
  Hexagon,
  Bell,
  FileBarChart,
  BellRing,
  Settings,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

const mainNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tracking", href: "/map", icon: MapPin },
  { name: "Devices", href: "/devices", icon: Cpu },
  { name: "Geofences", href: "/geofences", icon: Hexagon },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "Reports", href: "/reports", icon: FileBarChart },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const notifActive = isActive("/notifications");
  const settingsActive = isActive("/settings");

  return (
    <aside
      className={`${
        collapsed ? "w-[72px]" : "w-[240px]"
      } bg-[#1E2A4A] min-h-screen flex flex-col gap-2 px-3 py-4 transition-all duration-200 ease-in-out relative overflow-visible`}
    >
      {/* Collapse toggle */}
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
          <span className="text-[20px] font-bold text-white whitespace-nowrap">
            Globo
          </span>
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
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
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

      {/* Notifications */}
      <Link
        href="/notifications"
        title={collapsed ? "Notifications" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
          collapsed ? "justify-center" : ""
        } ${
          notifActive
            ? "bg-[#2563EB] text-white font-medium"
            : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
        }`}
      >
        <BellRing className="w-5 h-5 shrink-0" />
        {!collapsed && "Notifications"}
      </Link>

      {/* Settings */}
      <Link
        href="/settings"
        title={collapsed ? "Settings" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
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

      {/* Admin Panel link */}
      {role === "super_admin" && (
        <Link
          href="/admin"
          title={collapsed ? "Admin Panel" : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
            collapsed ? "justify-center" : ""
          } text-[#F59E0B]/80 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5`}
        >
          <Shield className="w-5 h-5 shrink-0" />
          {!collapsed && "Admin Panel"}
        </Link>
      )}

      {/* User Area */}
      <div className={`flex items-center gap-2.5 px-2 py-2.5 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          M
        </div>
        {!collapsed && (
          <span className="text-[13px] font-medium text-white/85">
            Marcelino F.
          </span>
        )}
      </div>
    </aside>
  );
}
