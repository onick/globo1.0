import { auth } from "@/lib/auth";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default async function SettingsPage() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown>)?.role;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <NotificationSettings isSuperAdmin={role === "super_admin"} />
    </div>
  );
}
