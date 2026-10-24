import { auth } from "@/lib/auth";
import { GeofenceManager } from "@/components/geofences/geofence-manager";

export default async function GeofencesPage() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown>)?.role;
  return <GeofenceManager isSuperAdmin={role === "super_admin"} />;
}
