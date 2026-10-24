"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Action } from "@/lib/permissions";

const RoleContext = createContext<string | null>(null);

// The signed-in user's role, set once by the dashboard layout
export function RoleProvider({ role, children }: { role: string; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

// Whether the user may do something. Pages hide what they can't; the API refuses it anyway.
export function useCan(action: Action): boolean {
  return can(useContext(RoleContext), action);
}
