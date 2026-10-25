import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Header } from "@/components/layout/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as Record<string, unknown>)?.role;
  if (role !== "super_admin") redirect("/map");

  return (
    <div className="flex min-h-screen bg-base-200">
      <AdminSidebar />
      {/* min-w-0: a wide table scrolls inside its card instead of widening the page */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
