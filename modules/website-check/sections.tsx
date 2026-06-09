import type { ReactNode } from "react";
import type { WebsiteCheckOutput } from "./schema";
import { WEBSITE_CHECK_KNOWN_FIELDS } from "./schema";

// ── Section-type ───────────────────────────────────────────────────

export type SectionDef = {
  id: string;
  defaultTitle: string;
  description: string; // voor admin-UI: korte omschrijving
  Component: (props: {
    data: WebsiteCheckOutput;
    title: string;
    intro: string | null;
  }) => ReactNode;
};

// ── Helpers (eerder in WebsiteCheckResultView) ─────────────────────

function scoreColor(score: number): {
  bg: string;
  text: string;
  bar: string;
} {
  if (score >= 7.5)
    return { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (score >= 5)
    return { bg: "bg-amber-100", text: "text-amber-700", bar: "bg-amber-500" };
  return { bg: "bg-rose-100", text: "text-rose-700", bar: "bg-rose-500" };
}

function impactBadge(impact: "hoog" | "middel" | "laag") {
  const cls =
    impact === "hoog"
      ? "bg-purple-600 text-white"
      : impact === "middel"
        ? "bg-amber-500 text-white"
        : "bg-gray-300 text-gray-800";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${cls}`}>
      {impact}
    </span>
  );
}

function renderExtraValue(value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }
  if (typeof value === "string") {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return (
      <ul className="list-disc pl-5 text-sm">
        {value.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  }
  return (
    <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function IntroP({ intro }: { intro: string | null }) {
  if (!intro) return null;
  return <p className="mt-2 text-sm text-gray-600">{intro}</p>;
}

// ── Section-componenten ────────────────────────────────────────────

function ScoreBanner({
  data,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-[7px] border-purple-600 text-purple-700">
        <div className="text-2xl font-extrabold leading-none">
          {data.overallScore.toFixed(1)}
        </div>
        <div className="text-[10px] text-purple-500">/ 10</div>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{data.companyName}</h1>
        <p className="text-gray-600">{data.websiteUrl}</p>
        <IntroP intro={intro} />
      </div>
    </div>
  );
}

function ExecutiveSummary({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <IntroP intro={intro} />
      <p className="mt-2 text-gray-800">{data.executiveSummary}</p>
    </section>
  );
}

function OnderdelenGrid({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">
        {title} ({data.onderdelen.length})
      </h2>
      <IntroP intro={intro} />
      <div className="space-y-2">
        {data.onderdelen.map((o, i) => {
          const c = scoreColor(o.score);
          return (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <strong>
                  {i + 1}. {o.naam}
                </strong>
                <span
                  className={`rounded-md px-2.5 py-0.5 text-sm font-extrabold ${c.bg} ${c.text}`}
                >
                  {o.score}/10
                </span>
              </div>
              <div className="my-2 h-1.5 w-full rounded bg-gray-200">
                <div
                  className={`h-1.5 rounded ${c.bar}`}
                  style={{ width: `${(o.score / 10) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-700">{o.toelichting}</p>
              {o.verbeterpunten.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
                  {o.verbeterpunten.map((vp, j) => (
                    <li key={j}>{vp}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SterkePunten({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="font-bold text-emerald-700">{title}</h3>
      <IntroP intro={intro} />
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
        {data.sterkePunten.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

function Verbeterpunten({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-bold text-amber-700">{title}</h3>
      <IntroP intro={intro} />
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
        {data.verbeterpunten.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

function TopActies({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <IntroP intro={intro} />
      <ol className="space-y-2">
        {data.topActies.map((a, i) => (
          <li key={i} className="rounded-xl border p-3">
            <div className="flex items-start gap-2">
              {impactBadge(a.impact)}
              <strong>{a.actie}</strong>
            </div>
            <p className="mt-1 text-sm text-gray-700">{a.toelichting}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AanvullendeInfo({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  const extras = Object.entries(data as Record<string, unknown>).filter(
    ([k]) => !WEBSITE_CHECK_KNOWN_FIELDS.has(k),
  );
  if (extras.length === 0) return null;
  return (
    <section className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
      <h2 className="mb-3 text-lg font-bold text-purple-900">{title}</h2>
      <IntroP intro={intro} />
      <p className="mb-3 text-xs text-purple-700/70">
        Extra velden uit de admin-prompt — verschijnen automatisch als de prompt
        naar een veld vraagt dat niet in het standaardresultaat zit.
      </p>
      <dl className="space-y-3 text-sm">
        {extras.map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold text-purple-900">{humanizeKey(k)}</dt>
            <dd className="mt-0.5 text-gray-800">{renderExtraValue(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── SECTIONS-registry ──────────────────────────────────────────────

export const SECTIONS: SectionDef[] = [
  {
    id: "score-banner",
    defaultTitle: "Overall score",
    description: "Paarse banner met overall score + bedrijfsnaam + URL.",
    Component: ScoreBanner,
  },
  {
    id: "executive-summary",
    defaultTitle: "Samenvatting",
    description: "Korte uitleg-paragraaf.",
    Component: ExecutiveSummary,
  },
  {
    id: "onderdelen-grid",
    defaultTitle: "Score per onderdeel",
    description: "Lijst met 11 sub-score-kaarten.",
    Component: OnderdelenGrid,
  },
  {
    id: "sterke-punten",
    defaultTitle: "Top 3 sterke punten",
    description: "Bullets met sterke punten (groen).",
    Component: SterkePunten,
  },
  {
    id: "verbeterpunten",
    defaultTitle: "Top 3 verbeterpunten",
    description: "Bullets met verbeterpunten (amber).",
    Component: Verbeterpunten,
  },
  {
    id: "top-acties",
    defaultTitle: "Top 5 prioriteitsacties",
    description: "Genummerde lijst met acties + impact-badges.",
    Component: TopActies,
  },
  {
    id: "aanvullende-info",
    defaultTitle: "Aanvullende info",
    description: "Dynamische extras uit de admin-prompt (passthrough-velden).",
    Component: AanvullendeInfo,
  },
];
