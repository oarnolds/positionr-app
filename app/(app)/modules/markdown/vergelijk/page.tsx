import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VergelijkClient } from "./VergelijkClient";

// De vergelijking laat 3 modellen parallel 150 images beschrijven. Zelfs
// bij worst-case parallel-runs komen we niet boven ~120s, maar we pakken
// 300s voor headroom bij trage sites/Anthropic-latency.
export const maxDuration = 300;

export default async function VergelijkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/markdown/vergelijk");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <Scale className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Model-vergelijking</h1>
          <p className="text-gray-600">
            Vergelijk kost en kwaliteit van image-descriptions tussen
            Haiku 4.5, Opus 5 en Fable 5.
          </p>
        </div>
      </div>

      <VergelijkClient />
    </div>
  );
}
