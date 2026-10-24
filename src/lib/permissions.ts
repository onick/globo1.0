// Shared by the API routes and the pages (which hide what a role can't do)
export type Role = "super_admin" | "admin" | "operator" | "viewer";

// What each role may change inside its client. Reading is open to every role; a user's
// own profile and password are not here, everyone manages their own.
//   admin:    everything
//   operator: day-to-day work, but can't delete vehicles or change the client's settings
//   viewer:   read only
export const PERMISSIONS = {
  "vehicles:create": ["super_admin", "admin", "operator"],
  "vehicles:edit": ["super_admin", "admin", "operator"],
  "vehicles:delete": ["super_admin", "admin"],
  "geofences:manage": ["super_admin", "admin", "operator"],
  "alerts:acknowledge": ["super_admin", "admin", "operator"],
  // Settings
  "notifications:manage": ["super_admin", "admin"],
  "company:edit": ["super_admin", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

export function can(role: unknown, action: Action): boolean {
  return (PERMISSIONS[action] as readonly unknown[]).includes(role);
}
