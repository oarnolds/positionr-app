import Link from "next/link";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";
import { MODULES } from "@/lib/modules/registry";

// Alle modules uit de registry, gegroepeerd per pakket. Alleen top-level
// (geen sub-prompts), in registry-volgorde.
const TOP_LEVEL = MODULES.filter((m) => !m.parentSlug);

export default async function LayoutsIndexPage() {
  // Welke modules hebben format_example gezet?
  const rows = await db
    .select({ slug: modules.slug, hasExample: modules.formatExample })
    .from(modules)
    .where(inArray(modules.slug, TOP_LEVEL.map((m) => m.slug)));

  const filled = new Set(
    rows.filter((r) => r.hasExample !== null).map((r) => r.slug),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Layouts</h1>
        <p className="text-sm text-slate-600">
          Markdown-template per module. Bewerk wat de AI moet produceren.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOP_LEVEL.map((m) => {
          const has = filled.has(m.slug);
          return (
            <Link
              key={m.slug}
              href={`/admin/layouts/${m.slug}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-purple-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900">{m.name}</div>
                {has ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    ingevuld
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    leeg
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">{m.slug}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                {m.minTier}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
