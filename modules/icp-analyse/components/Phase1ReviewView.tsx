"use client";

import { useTransition } from "react";
import {
  Sparkles,
  Users,
  Zap,
  AlertCircle,
  Compass,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmPhase1 } from "@/app/(app)/modules/icp-analyse/actions";
import type { Phase1Output } from "@/modules/icp-analyse/schema";

export function Phase1ReviewView({
  productId,
  sessionId,
  data,
}: {
  productId: string;
  sessionId: string;
  data: Phase1Output;
}) {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(() => {
      confirmPhase1(productId, sessionId);
    });
  }

  const score = data.betrouwbaarheid_score;
  const promColor = (p: "hoog" | "middel" | "laag") =>
    p === "hoog"
      ? "bg-blue-100 text-blue-700"
      : p === "middel"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-600";
  const invloedColor = (
    i: "beslisser" | "beïnvloeder" | "gebruiker"
  ) =>
    i === "beslisser"
      ? "bg-red-100 text-red-700"
      : i === "beïnvloeder"
      ? "bg-amber-100 text-amber-700"
      : "bg-green-100 text-green-700";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analyse-resultaten</h2>
          <p className="mt-1 text-sm text-gray-600">
            Klopt dit met je bedrijf? Bevestig of pas aan in de vragenlijst.
          </p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
          {score}% betrouwbaar
        </span>
      </div>

      {/* Betrouwbaarheid + ontbrekend */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-blue-900">
            Betrouwbaarheid van de analyse
          </span>
          <span className="text-sm font-bold text-blue-900">{score}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
            style={{ width: `${score}%` }}
          />
        </div>
        {data.ontbrekende_informatie.length > 0 && (
          <div className="mt-3 text-xs leading-relaxed text-blue-800">
            <span className="font-semibold">Ontbrekend:</span>{" "}
            {data.ontbrekende_informatie.join(" · ")}
          </div>
        )}
      </div>

      {/* Diensten */}
      <Section
        accent="blue"
        icon={<Sparkles className="h-4 w-4" />}
        title="Diensten & Producten"
      >
        <ul className="space-y-2">
          {data.diensten.map((d, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${promColor(d.prominentie)}`}
              >
                {d.prominentie}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{d.naam}</p>
                <p className="text-xs leading-relaxed text-gray-600">
                  {d.beschrijving}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Primaire doelgroep */}
      <Section
        accent="indigo"
        icon={<Users className="h-4 w-4" />}
        title="Primaire doelgroep"
      >
        <dl className="space-y-2 text-sm">
          <Fact label="Sector" value={data.primaire_doelgroep.sector} />
          <Fact label="Subsector" value={data.primaire_doelgroep.subsector} />
          <Fact label="Grootte" value={data.primaire_doelgroep.bedrijfsgrootte} />
          <Fact
            label="Regio"
            value={data.primaire_doelgroep.geografische_focus}
          />
        </dl>
        <p className="mt-3 text-xs uppercase tracking-wide text-indigo-700">
          Functietitels
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {data.primaire_doelgroep.functietitels.map((f, i) => (
            <span
              key={i}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-900"
            >
              {f}
            </span>
          ))}
        </div>
      </Section>

      {/* Pijnpunten */}
      <Section
        accent="amber"
        icon={<AlertCircle className="h-4 w-4" />}
        title="Pijnpunten"
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
          {data.pijnpunten.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </Section>

      {/* Trigger Events + USP + Klantvoorbeelden */}
      <Section
        accent="purple"
        icon={<Zap className="h-4 w-4" />}
        title="Trigger Events &amp; USP"
      >
        <p className="text-xs uppercase tracking-wide text-purple-700">
          Trigger events
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {data.trigger_events.map((t, i) => (
            <span
              key={i}
              className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs text-purple-900"
            >
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs uppercase tracking-wide text-purple-700">USP</p>
        <p className="text-sm leading-relaxed text-gray-800">{data.usp}</p>
        {data.klantvoorbeelden.length > 0 && (
          <>
            <p className="mt-3 text-xs uppercase tracking-wide text-purple-700">
              Klantvoorbeelden
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.klantvoorbeelden.map((k, i) => (
                <span
                  key={i}
                  className="rounded-full border border-gray-300 bg-white px-3 py-0.5 text-xs text-gray-700"
                >
                  {k}
                </span>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Eerste ICP Inschatting */}
      <Section
        accent="teal"
        icon={<Compass className="h-4 w-4" />}
        title="Eerste ICP-inschatting"
      >
        <p className="text-sm leading-relaxed text-gray-800">
          {data.icp_inschatting.samenvatting}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-teal-700">
              Industrieën
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.icp_inschatting.industrieen.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-900"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs uppercase tracking-wide text-teal-700">
              Bedrijfsgrootte
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.icp_inschatting.bedrijfsgrootte.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-900"
                >
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs uppercase tracking-wide text-teal-700">
              Kernprocessen
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.icp_inschatting.kernprocessen.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-900"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-teal-700">
              Decision Making Unit (DMU)
            </p>
            <ul className="mt-1 space-y-1">
              {data.icp_inschatting.dmu.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 text-gray-800">
                    <Briefcase className="h-3 w-3 text-gray-500" />
                    {m.rol}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${invloedColor(m.invloed)}`}
                  >
                    {m.invloed}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleConfirm} disabled={pending} className="gap-2">
          {pending ? "Bezig..." : "Ja, klopt — ga naar vragenlijst"}
        </Button>
        <Button
          variant="outline"
          onClick={handleConfirm}
          disabled={pending}
        >
          Aanpassen in vragenlijst
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACCENTS: Record<
  string,
  { border: string; bg: string; iconBg: string; iconText: string }
> = {
  blue: {
    border: "border-blue-200",
    bg: "bg-white",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
  },
  indigo: {
    border: "border-indigo-200",
    bg: "bg-white",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-white",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
  },
  purple: {
    border: "border-purple-200",
    bg: "bg-white",
    iconBg: "bg-purple-100",
    iconText: "text-purple-700",
  },
  teal: {
    border: "border-teal-200",
    bg: "bg-white",
    iconBg: "bg-teal-100",
    iconText: "text-teal-700",
  },
};

function Section({
  accent,
  icon,
  title,
  children,
}: {
  accent: keyof typeof ACCENTS;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <section className={`rounded-2xl border ${a.border} ${a.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-lg ${a.iconBg} p-1.5 ${a.iconText}`}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value || "—"}</dd>
    </div>
  );
}
