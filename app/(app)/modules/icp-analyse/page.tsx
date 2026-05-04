import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { clients, icpProducts } from "@/lib/db/schema";
import { CatalogPage } from "@/modules/icp-analyse/components/CatalogPage";

export default async function ICPCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; error?: string }>;
}) {
  const { clientId: selectedClientId, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Klanten van deze user
  const myClients = await db
    .select({
      id: clients.id,
      name: clients.name,
      websiteUrl: clients.websiteUrl,
    })
    .from(clients)
    .where(eq(clients.userId, user.id))
    .orderBy(clients.name);

  // Actieve klant: uit query of eerste in lijst
  const activeClientId = selectedClientId ?? myClients[0]?.id ?? null;

  // Producten van actieve klant
  const products = activeClientId
    ? await db
        .select()
        .from(icpProducts)
        .where(eq(icpProducts.clientId, activeClientId))
        .orderBy(desc(icpProducts.createdAt))
    : [];

  const activeClient = myClients.find((c) => c.id === activeClientId) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-cyan-100 p-3 text-cyan-600">
          <UserCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Producten &amp; Diensten Catalogus</h1>
          <p className="text-gray-600">
            Beheer hier producten en diensten per klant. Per item kun je een ICP-analyse
            uitvoeren.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-8">
        <CatalogPage
          clients={myClients}
          activeClient={activeClient}
          products={products}
        />
      </div>
    </div>
  );
}
