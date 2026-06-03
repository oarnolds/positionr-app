import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HeroMockup } from "@/components/marketing/HeroMockup";
import { TrustBand } from "@/components/marketing/TrustBand";
import { StepsSection } from "@/components/marketing/StepsSection";
import { TestimonialBlock } from "@/components/marketing/TestimonialBlock";
import { PricingTeaser } from "@/components/marketing/PricingTeaser";
import {
  ArrowRight,
  Check,
  HelpCircle,
  MousePointerClick,
  Sparkles,
  Tag,
  X,
  Zap,
} from "lucide-react";

const recognizableQuestions = [
  "Bereiken we de juiste doelgroep?",
  "Waarom converteert onze website niet?",
  "Wat doen concurrenten beter?",
  "Hoe meet ik marketing-ROI?",
  "Welke kanalen werken écht?",
  "Wat is onze USP eigenlijk?",
  "Hoe stuur ik mijn marketeer aan?",
  "Investeren in SEO of SEA?",
  "Hoe krijg ik grip op marketing?",
];

const valueProps = [
  {
    eyebrow: "Sneller",
    icon: Zap,
    title: "Minuten naar inzicht",
    description:
      "Wat een bureau in dagen levert, krijg jij in minuten op je scherm — concreet en direct toepasbaar.",
  },
  {
    eyebrow: "Eenvoudiger",
    icon: MousePointerClick,
    title: "Klik. Lees. Beslis.",
    description:
      "Geen demo, geen training, geen handleiding. Loopt het ergens vast? Dan passen wij de tool aan, niet de instructie.",
  },
  {
    eyebrow: "Goedkoper",
    icon: Tag,
    title: "Eén jaarbedrag, alle modules in je pakket",
    description:
      "Geen uurtarieven, geen consultancy-add-ons, geen verrassingen. Een fractie van wat een bureau-traject kost.",
  },
];

const forYou = [
  "Je bent directeur-eigenaar (DGA) van je bedrijf",
  "Je bedrijf telt 5 tot 50 FTE",
  "Sector: zakelijke dienstverlening (advocaten, architecten), technologie/software of financiële dienstverlening",
  "Je wilt zelf grip — geen weken consultancy",
];

const notForYou = [
  "B2C en consumentenmarkten",
  "Retail en webshops",
  "Internationale rollouts (we starten in Nederland)",
  "Grote organisaties met eigen marketingteam of vast bureau",
];

export default function LandingPage() {
  return (
    <>
      {/* Hero — split layout */}
      <section className="bg-white pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              <Sparkles className="h-3 w-3 text-primary" />
              Voor directeur-eigenaren in NL B2B-MKB
            </div>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
              De second opinion
              <br />
              voor je marketing&shy;beslissingen.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Zo concreet en herkenbaar dat je voelt: <em>dit is wat een
              ervaren marketeer mij zou zeggen</em> — alleen sneller, eenvoudiger
              en goedkoper. Geen bureau, geen demo. Gewoon zelf doen.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/gratis-check">
                <Button size="lg" className="w-full sm:w-auto">
                  Doe de gratis Website Check{" "}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/prijzen">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Bekijk pakketten
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Resultaat binnen 2 minuten · geen creditcard nodig
            </p>
          </div>
          <div className="lg:pl-4">
            <HeroMockup />
          </div>
        </div>
      </section>

      <TrustBand />

      <StepsSection />

      {/* Herkenbare vragen */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Herkenbare vragen
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              Klinkt dit bekend?
            </h2>
            <p className="mt-3 text-base text-slate-600">
              De vragen die ondernemers ons stellen. Je bent niet de enige —
              en op elke vraag krijg je via Positionr een onderbouwd antwoord.
            </p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recognizableQuestions.map((q) => (
              <div
                key={q}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium text-slate-800">{q}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Drie pijlers */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Onze drie beloftes
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              Sneller. Eenvoudiger. Goedkoper.
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Drie gelijkwaardige claims die je in elke module terugziet — geen
              loze marketing, maar de meetlat waarmee we onze tool bouwen.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {valueProps.map(({ eyebrow, icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-primary">
                  {eyebrow}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-sm text-slate-500">
            Onze modules bouwen op decennia praktijk én op het werk van
            marketing-autoriteiten als{" "}
            <span className="font-medium text-slate-700">Cialdini</span>,{" "}
            <span className="font-medium text-slate-700">Ritson</span> en{" "}
            <span className="font-medium text-slate-700">Kotler</span>.
          </p>
        </div>
      </section>

      <TestimonialBlock />

      {/* Voor wie / niet voor wie */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Doelgroep
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              Voor wie is Positionr?
            </h2>
            <p className="mt-3 text-base text-slate-600">
              We zijn duidelijk over voor wie we werken — en voor wie niet.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/30 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-primary">Wél voor jou</h3>
              <ul className="mt-4 space-y-3">
                {forYou.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-800"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-500">
                Minder geschikt
              </h3>
              <ul className="mt-4 space-y-3">
                {notForYou.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-500"
                  >
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <PricingTeaser />

      {/* Slot-CTA */}
      <section className="bg-slate-900 py-24 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Klaar voor je second opinion?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Begin met de gratis Website Check. Geen account, geen creditcard.
            Resultaat binnen 2 minuten.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/gratis-check">
              <Button size="lg" className="w-full bg-white text-slate-900 hover:bg-slate-100 sm:w-auto">
                Doe de gratis Website Check{" "}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/prijzen">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 sm:w-auto"
              >
                Of bekijk de pakketten
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
