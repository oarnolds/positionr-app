import {
  Star,
  AlertCircle,
  XCircle,
  Megaphone,
  Compass,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { FinalIcp } from "@/modules/icp-analyse/schema";

export function FinalIcpView({
  productName,
  data,
  betrouwbaarheid,
}: {
  productName: string;
  data: FinalIcp;
  betrouwbaarheid: number;
}) {
  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 p-6 text-white shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
            {data.positionering === "verticaal"
              ? "Verticale positionering"
              : "Horizontale positionering"}
          </span>
          {betrouwbaarheid > 0 && (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
              {betrouwbaarheid}% website analyse
            </span>
          )}
        </div>
        <p className="mt-3 text-xs uppercase tracking-wide opacity-80">
          {productName}
        </p>
        <p className="mt-1 text-base leading-relaxed">{data.heroTekst}</p>
      </div>

      {/* "Waarom kiezen klanten voor ons?" — USP */}
      <Section
        accent="purple"
        icon={<Star className="h-5 w-5" />}
        eyebrow="WAAROM KIEZEN KLANTEN VOOR ONS?"
      >
        <p className="text-sm leading-relaxed text-purple-950">{data.usp}</p>
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Firmografisch */}
        <Section
          accent="blue"
          icon={<Compass className="h-4 w-4" />}
          title="Firmografisch profiel"
        >
          <dl className="space-y-2 text-sm">
            <Fact label="Sector" value={data.firmografisch.sector} />
            <Fact label="Subsector" value={data.firmografisch.subsector} />
            <Fact
              label="Bedrijfsgrootte"
              value={data.firmografisch.bedrijfsgrootte.join(", ")}
            />
            <Fact
              label="Contactfunctie"
              value={data.firmografisch.contactfunctie}
            />
            <Fact label="Beslisser" value={data.firmografisch.beslisser} />
            <Fact
              label="Contractwaarde"
              value={data.firmografisch.contractwaarde}
            />
            <Fact
              label="Vindkanalen"
              value={data.firmografisch.vindkanalen.join(", ")}
            />
          </dl>
        </Section>

        {/* Pijnpunten & Triggers */}
        <Section
          accent="amber"
          icon={<Zap className="h-4 w-4" />}
          title="Pijnpunten & Triggers"
        >
          <p className="text-xs uppercase tracking-wide text-amber-700">
            Primair pijnpunt
          </p>
          <p className="mt-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            {data.pijnpuntenTriggers.pijnpunt}
          </p>
          <p className="mt-3 text-xs uppercase tracking-wide text-amber-700">
            Trigger events
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {data.pijnpuntenTriggers.triggers.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900"
              >
                <Zap className="h-3 w-3" />
                {t}
              </span>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Dienst-focus */}
        <Section
          accent="green"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Dienst / Product Focus"
        >
          <p className="text-sm font-semibold text-gray-900">
            {data.dienstFocus.dienst}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-green-700">
            Contractwaarde
          </p>
          <p className="text-sm text-gray-900">
            {data.dienstFocus.contractwaarde}
          </p>
          <p className="mt-3 text-xs uppercase tracking-wide text-green-700">
            ICP-match
          </p>
          <p className="text-sm leading-relaxed text-gray-900">
            {data.dienstFocus.icpMatch}
          </p>
        </Section>

        {/* Negatieve ICP */}
        <Section
          accent="red"
          icon={<XCircle className="h-4 w-4" />}
          title="Negatieve ICP — Wanneer is het geen match?"
        >
          <p className="text-xs uppercase tracking-wide text-red-700">
            Dealbreakers
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {data.negatieveIcp.dealbreakers.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-900"
              >
                <XCircle className="h-3 w-3" />
                {d}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-red-700">
            Disqualificatievraag
          </p>
          <p className="mt-1 rounded-lg bg-red-50 p-3 text-sm italic text-red-900">
            &ldquo;{data.negatieveIcp.disqualificatievraag}&rdquo;
          </p>
        </Section>
      </div>

      {/* Marketing-vertaalslag */}
      <Section
        accent="indigo"
        icon={<Megaphone className="h-5 w-5" />}
        title="Marketing-vertaalslag"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-700">
              Kanalen
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {data.marketingVertaalslag.kanalen.map((k, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-gray-900">
                    {k.kanaal}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                      k.prioriteit.toLowerCase() === "hoog"
                        ? "bg-indigo-200 text-indigo-900"
                        : k.prioriteit.toLowerCase() === "middel"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {k.prioriteit}
                  </span>
                  <span className="text-gray-700">— {k.reden}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-700">
              Kernboodschap per fase
            </p>
            <div className="mt-1 grid gap-2 text-sm sm:grid-cols-3">
              <FunnelStep
                label="Bewustwording"
                text={data.marketingVertaalslag.kernboodschap.bewustwording}
              />
              <FunnelStep
                label="Overweging"
                text={data.marketingVertaalslag.kernboodschap.overweging}
              />
              <FunnelStep
                label="Beslissing"
                text={data.marketingVertaalslag.kernboodschap.beslissing}
              />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-700">
              Content-aanbevelingen
            </p>
            <ul className="mt-1 space-y-1 text-sm text-gray-800">
              <li>
                <span className="font-semibold">Artikel:</span>{" "}
                {data.marketingVertaalslag.contentAanbevelingen.artikel}
              </li>
              <li>
                <span className="font-semibold">LinkedIn:</span>{" "}
                {data.marketingVertaalslag.contentAanbevelingen.linkedin}
              </li>
              <li>
                <span className="font-semibold">E-mail:</span>{" "}
                {data.marketingVertaalslag.contentAanbevelingen.email}
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Volgende stappen */}
      <Section
        accent="teal"
        icon={<AlertCircle className="h-4 w-4" />}
        title="Volgende stappen"
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-800">
          {data.volgendStappen.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

const ACCENTS: Record<
  string,
  { border: string; bg: string; iconBg: string; iconText: string }
> = {
  purple: {
    border: "border-purple-200",
    bg: "bg-purple-50",
    iconBg: "bg-purple-100",
    iconText: "text-purple-700",
  },
  blue: {
    border: "border-blue-200",
    bg: "bg-white",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-white",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
  },
  green: {
    border: "border-green-200",
    bg: "bg-white",
    iconBg: "bg-green-100",
    iconText: "text-green-700",
  },
  red: {
    border: "border-red-200",
    bg: "bg-white",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
  },
  indigo: {
    border: "border-indigo-200",
    bg: "bg-white",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
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
  eyebrow,
  children,
}: {
  accent: keyof typeof ACCENTS;
  icon: React.ReactNode;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <section className={`rounded-2xl border ${a.border} ${a.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-lg ${a.iconBg} p-1.5 ${a.iconText}`}>
          {icon}
        </span>
        {eyebrow ? (
          <span className={`text-xs font-bold uppercase tracking-wide ${a.iconText}`}>
            {eyebrow}
          </span>
        ) : (
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        )}
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

function FunnelStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-indigo-950">{text}</p>
    </div>
  );
}
