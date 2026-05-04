import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions, icpProducts } from "@/lib/db/schema";
import { WebformWizard } from "@/modules/icp-analyse/components/WebformWizard";
import type { WebformAnswers } from "@/modules/icp-analyse/schema";

export default async function ICPVolledigWebformPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { productId, sessionId } = await params;
  const { error } = await searchParams;

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
  if (!session || session.userId !== user.id) notFound();

  const [product] = await db
    .select()
    .from(icpProducts)
    .where(eq(icpProducts.id, productId))
    .limit(1);
  if (!product || product.id !== session.productId) notFound();

  const output = (session.output ?? {}) as {
    webformAnswers?: Partial<WebformAnswers>;
    webformStep?: number;
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/modules/icp-analyse/${productId}/volledig/${sessionId}/phase1`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Phase 1 Review
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-bold text-gray-900">Vragenlijst</h1>
        <p className="mt-1 text-sm text-gray-600">
          Bevestig of corrigeer de inschatting. Hoe scherper je antwoord, hoe scherper het
          ICP-profiel.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6">
        <WebformWizard
          productId={productId}
          sessionId={sessionId}
          productName={product.name}
          initial={output.webformAnswers ?? {}}
          initialStep={output.webformStep ?? 1}
        />
      </div>
    </div>
  );
}
