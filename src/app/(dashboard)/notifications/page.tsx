import { auth } from "@/lib/auth";
import { NotificationSettings } from "@/components/settings/notification-settings";

// Who gets alerts by email or WhatsApp
export default async function NotificationsPage() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown>)?.role;
  return <NotificationSettings isSuperAdmin={role === "super_admin"} />;
}
