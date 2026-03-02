import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
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
    <div className="flex min-h-screen">
      <Sidebar role={role as string} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-zinc-50">{children}</main>
      </div>
    </div>
  );
}
