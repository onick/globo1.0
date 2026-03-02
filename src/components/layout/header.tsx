import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div className="text-sm text-zinc-500">
        {(session?.user as Record<string, unknown>)?.tenantSlug as string ||
          "Super Admin"}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm">{session?.user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
