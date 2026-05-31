import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, LineChart, Sparkles } from "lucide-react";

const valueProps = [
  {
    icon: Compass,
    title: "Strakke positionering",
    description:
      "Helder zicht op je ideale klant, propositie en concurrentie — zonder consultancy-uurtarief.",
  },
  {
    icon: LineChart,
    title: "Meetbare grip",
    description:
      "Scores en concrete actiepunten per analyse, zodat je weet wat te doen.",
  },
  {
    icon: Sparkles,
    title: "AI met praktijkkennis",
    description:
      "Modules gebouwd op decennia marketing- en sales-ervaring — niet zomaar een GPT-wrapper.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-6xl font-bold text-transparent">
          Positionr
        </h1>
        <p className="mt-6 text-xl text-gray-600">
          Snel inzicht in wat je marketing oplevert,
          <br />
          zodat je met vertrouwen kunt bijsturen.
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
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {valueProps.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur"
            >
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">Klaar om grip te krijgen?</h2>
        <p className="mt-4 text-muted-foreground">
          Kies een abonnement en log binnen 1 minuut in.
        </p>
        <div className="mt-8">
          <Link href="/prijzen">
            <Button size="lg">
              Naar de prijzen <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
