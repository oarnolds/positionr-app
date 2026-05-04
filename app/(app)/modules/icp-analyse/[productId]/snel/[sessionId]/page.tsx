import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions, icpProducts } from "@/lib/db/schema";
import { FinalIcpView } from "@/modules/icp-analyse/components/FinalIcpView";
import { FinalIcp } from "@/modules/icp-analyse/schema";

export default async function ICPSnelResultPage({
  params,
}: {
  params: Promise<{ productId: string; sessionId: string }>;
}) {
  const { productId, sessionId } = await params;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.moduleSlug !== "icp-analyse") notFound();

  const [product] = await db
    .select()
    .from(icpProducts)
    .where(eq(icpProducts.id, productId))
    .limit(1);
  if (!product || product.id !== session.productId) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/modules/icp-analyse/${productId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Modus-keuze
        </Link>
        <Link
          href={`/modules/icp-analyse?clientId=${product.clientId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Catalogus →
        </Link>
      </div>

      <div className="mt-6">
        {session.status === "running" && <RunningState />}
        {session.status === "failed" && (
          <FailedState
            message={session.errorMessage ?? "Onbekende fout"}
            productId={productId}
          />
        )}
        {session.status === "approved" && session.output ? (
          (() => {
            const output = session.output as { finalIcp?: unknown; betrouwbaarheid?: number };
            const parsed = output.finalIcp
              ? FinalIcp.safeParse(output.finalIcp)
              : null;
            if (!parsed?.success) {
              return (
                <FailedState
                  message="Resultaat-data is corrupt of incompleet."
                  productId={productId}
                />
              );
            }
            return (
              <FinalIcpView
                productName={product.name}
                data={parsed.data}
                betrouwbaarheid={output.betrouwbaarheid ?? 0}
              />
            );
          })()
        ) : null}
      </div>
    </div>
  );
}

function RunningState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-12 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
      <p className="mt-4 text-sm text-cyan-900">
        Analyse wordt uitgevoerd... pagina ververst zich automatisch.
      </p>
      <meta httpEquiv="refresh" content="3" />
    </div>
  );
}

function FailedState({
  message,
  productId,
}: {
  message: string;
  productId: string;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-900">Analyse mislukt</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <Link
        href={`/modules/icp-analyse/${productId}`}
        className="mt-4 inline-block text-sm text-red-700 underline"
      >
        Probeer opnieuw
      </Link>
    </div>
  );
}
