"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Map, Cpu, Settings, CreditCard, Building2 } from "lucide-react";

const navigation = [
  { name: "Map", href: "/map", icon: Map },
  { name: "Devices", href: "/devices", icon: Cpu },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "Plans", href: "/admin/plans", icon: CreditCard },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const items =
    role === "super_admin"
      ? [...navigation, ...adminNavigation]
      : navigation;

  return (
    <aside className="w-64 bg-zinc-900 text-white min-h-screen p-4 flex flex-col">
      <div className="text-xl font-bold mb-8 px-2">Globo GPS</div>
      <nav className="space-y-1 flex-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
