"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Cpu, Settings, LayoutDashboard, Radio } from "lucide-react";

const navigation = [
  { name: "Map", href: "/map", icon: Map },
  { name: "Devices", href: "/devices", icon: Cpu },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-neutral min-h-screen flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-success/20 flex items-center justify-center">
          <Radio className="w-3.5 h-3.5 text-success" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-neutral-content">
          Globo GPS
        </span>
      </div>

      {/* Navigation — daisyUI menu */}
      <ul className="menu menu-sm flex-1 px-3 mt-2 gap-0.5">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? "bg-neutral-content/10 text-neutral-content font-medium" : "text-neutral-content/60 hover:text-neutral-content hover:bg-neutral-content/5"}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {active && (
                  <span className="ml-auto status status-success" />
                )}
              </Link>
            </li>
          );
        })}
        {role === "super_admin" && (
          <li className="mt-4">
            <Link
              href="/admin"
              className="text-warning/80 hover:text-warning hover:bg-warning/5"
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin Panel
            </Link>
          </li>
        )}
      </ul>

      {/* Footer — system status */}
      <div className="px-5 py-4 border-t border-neutral-content/10">
        <div className="flex items-center gap-2">
          <span className="status status-success animate-pulse" />
          <span className="text-[11px] text-neutral-content/50 tracking-wide uppercase">
            System Online
          </span>
        </div>
      </div>
    </aside>
  );
}
