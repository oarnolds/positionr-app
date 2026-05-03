import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { InputForm } from "@/modules/icp-analyse/components/InputForm";

export default async function ICPInputPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const myClients = await db
    .select({
      id: clients.id,
      name: clients.name,
      websiteUrl: clients.websiteUrl,
    })
    .from(clients)
    .where(eq(clients.userId, user.id))
    .orderBy(clients.name);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
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
          <h1 className="text-3xl font-bold">Ideale Klant (ICP) Analyse</h1>
          <p className="text-gray-600">
            Definieer het ideale klantprofiel voor jouw product op basis van je
            website en een korte productomschrijving.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-8">
        <InputForm clients={myClients} />
      </div>
    </div>
  );
}
