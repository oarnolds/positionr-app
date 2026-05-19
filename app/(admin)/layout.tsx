import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { LogOut, FileText, Wand2, Users, ArrowLeft } from "lucide-react";
import { signOut } from "../(app)/actions";

const ADMIN_NAV = [
  { href: "/admin", label: "Sessies", icon: FileText },
  { href: "/admin/prompts", label: "Prompts", icon: Wand2 },
  { href: "/admin/gebruikers", label: "Gebruikers", icon: Users },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (profile?.role !== "admin") redirect("/modules");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 border-r bg-white">
        <div className="border-b px-5 py-4">
          <Link
            href="/admin"
            className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-lg font-bold text-transparent"
          >
            Positionr Admin
          </Link>
        </div>
        <nav className="px-3 py-4">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-slate-100"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-60 border-t p-3 text-xs text-gray-500">
          <div className="mb-2 truncate">{user.email}</div>
          <div className="flex gap-2">
            <Link href="/modules" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <ArrowLeft className="h-3 w-3" /> App
              </Button>
            </Link>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-3 w-3" />
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
