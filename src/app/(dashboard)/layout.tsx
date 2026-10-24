import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      <Sidebar role={(session.user as Record<string, unknown>)?.role as string || "viewer"} />
      {/* min-w-0: wide content (report tables) scrolls inside its box instead of widening the page */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-5 overflow-auto">
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
