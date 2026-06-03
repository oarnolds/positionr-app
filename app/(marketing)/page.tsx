import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Compass,
  HelpCircle,
  Sparkles,
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
    icon: Zap,
    title: "Minuten naar inzicht",
    description:
      "Wat een bureau in dagen levert, krijg jij in minuten op je scherm — concreet en actiegericht.",
  },
  {
    icon: Compass,
    title: "60 jaar marketing, in AI gegoten",
    description:
      "De stem en logica van ervaren B2B-marketeers — geen generieke GPT-wrapper, wél praktijkkennis die je kunt vertrouwen.",
  },
  {
    icon: Sparkles,
    title: "Geen demo, geen contract",
    description:
      "Direct online afsluiten, opzegbaar per maand, één abonnement met alle modules. Geen sales-call.",
  },
];

const forYou = [
  "Je bent directeur, oprichter of commercieel verantwoordelijk",
  "Je bedrijf telt 5 tot 50 FTE",
  "B2B-dienstverlening, industrie of technologie",
  "Je wilt zelf grip — geen weken consultancy",
];

const notForYou = [
  "Grote organisaties met eigen marketingteam of vast bureau",
  "B2C / consumentenmarkten",
  "Internationale rollouts buiten Nederland",
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          Voor directeurs en oprichters van NL B2B-MKB
        </div>
        <h1 className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-6xl font-bold text-transparent">
          Positionr
        </h1>
        <p className="mt-6 text-2xl font-semibold text-gray-900">
          De second opinion voor jouw marketingbeslissingen.
        </p>
        <p className="mt-4 text-lg text-gray-600">
          Zo concreet en herkenbaar dat je voelt: <em>dit is wat een ervaren
          marketeer mij zou zeggen</em> — alleen sneller, eenvoudiger en
          goedkoper. Geen bureau, geen demo, gewoon zelf doen.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/gratis-check">
            <Button size="lg">
              Doe de gratis Website Check <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/prijzen">
            <Button size="lg" variant="outline">
              Bekijk abonnementen
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          In 2 minuten een eerste score, zonder account.
        </p>
      </section>

      {/* Herkenbare vragen */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Klinkt dit bekend?</h2>
          <p className="mt-3 text-muted-foreground">
            Dit zijn vragen die ondernemers ons stellen. Je bent niet de enige.
          </p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recognizableQuestions.map((q) => (
            <div
              key={q}
              className="flex items-start gap-3 rounded-xl border border-border bg-white/70 p-4 shadow-sm backdrop-blur"
            >
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-medium text-gray-800">{q}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Op elke vraag krijg je via Positionr in minuten een onderbouwd antwoord.
        </p>
      </section>

      {/* Wat krijg je */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Wat maakt Positionr anders</h2>
          <p className="mt-3 text-muted-foreground">
            Drie principes die je in elke module terugziet.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {valueProps.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur"
            >
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Voor wie */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Voor wie is Positionr?</h2>
          <p className="mt-3 text-muted-foreground">
            We zijn duidelijk over voor wie we werken — en voor wie niet.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-primary/30 bg-white/80 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-primary">Wél voor jou</h3>
            <ul className="mt-4 space-y-3">
              {forYou.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-white/60 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-muted-foreground">
              Minder geschikt
            </h3>
            <ul className="mt-4 space-y-3">
              {notForYou.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Slot-CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">Klaar voor je second opinion?</h2>
        <p className="mt-4 text-muted-foreground">
          Begin met de gratis Website Check. Geen account, geen creditcard.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/gratis-check">
            <Button size="lg">
              Doe de gratis Website Check <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/prijzen">
            <Button size="lg" variant="outline">
              Of bekijk de pakketten
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
