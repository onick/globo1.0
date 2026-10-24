"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

const REFRESH_MS = 30_000;

// Header bell with the number of unread alerts
export function AlertBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch("/api/alerts?count=unread")
        .then((res) => (res.ok ? res.json() : { unread: 0 }))
        .then((data: { unread: number }) => setUnread(data.unread))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    window.addEventListener("alerts:read", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("alerts:read", load);
    };
  }, []);

  return (
    <Link
      href="/alerts"
      aria-label={unread ? `${unread} unread alerts` : "Alerts"}
      className="relative p-2 rounded-md hover:bg-zinc-100"
    >
      <Bell className="h-5 w-5 text-zinc-600" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs flex items-center justify-center tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
