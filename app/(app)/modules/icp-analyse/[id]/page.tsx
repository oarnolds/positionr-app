import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { ResultView } from "@/modules/icp-analyse/components/ResultView";
import { ICPOutput } from "@/modules/icp-analyse/schema";

export default async function ICPResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.moduleSlug !== "icp-analyse") notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/modules/icp-analyse"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Nieuwe analyse
      </Link>

      <div className="mt-6">
        {session.status === "running" && <RunningState />}
        {session.status === "failed" && (
          <FailedState message={session.errorMessage ?? "Onbekende fout"} />
        )}
        {(session.status === "review" ||
          session.status === "approved" ||
          session.status === "draft") &&
        session.output ? (
          <ResultView data={ICPOutput.parse(session.output)} />
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

function FailedState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-900">Analyse mislukt</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <Link
        href="/modules/icp-analyse"
        className="mt-4 inline-block text-sm text-red-700 underline"
      >
        Probeer opnieuw
      </Link>
    </div>
  );
}
