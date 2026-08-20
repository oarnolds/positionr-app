"use client";

import { motion } from "motion/react";
import { Linkedin } from "lucide-react";
import Image from "next/image";

import { useReveal } from "./use-reveal";

/**
 * Oprichters-sectie: laat het gezicht en de ervaring zien achter Positionr.
 *
 * Foto's: leg jpg's neer op /public/founders/olivier.jpg en /martijn.jpg.
 * Zolang die niet bestaan, tonen we een cirkel met de initialen.
 * Om een echte foto te tonen: zet `photoSrc` op het pad; anders `null`.
 */
type Founder = {
  name: string;
  initials: string;
  role: string;
  yearsPractice: string;
  intro: string;
  linkedInUrl: string | null;
  photoSrc: string | null; // bv. "/founders/olivier.jpg"
};

const FOUNDERS: readonly Founder[] = [
  {
    name: "Olivier Arnolds",
    initials: "OA",
    role: "Oprichter · Product & marketing",
    yearsPractice: "30+ jaar in B2B-marketing en sales",
    intro:
      "Uit Amsterdam. Bouwt aan Positionr vanuit 30+ jaar ervaring in B2B-sales, marketing en business development. In elke module zit de manier waarop ik zelf een marketingvraag zou aanpakken: minder theorie, meer bruikbare stappen.",
    linkedInUrl: "https://www.linkedin.com/in/olivierarnolds/",
    photoSrc: "/founders/olivier.jpg",
  },
  {
    name: "Martijn de Haas",
    initials: "MdH",
    role: "Oprichter · Strategie",
    yearsPractice: "TU Delft · eigenaar De Haas BCD",
    intro:
      "Strateeg met een achtergrond aan de TU Delft en jaren ervaring bij een multinational. Runt sinds jaren zijn eigen strategie-praktijk (De Haas BCD) en helpt organisaties van MKB tot overheid ambitie om te zetten in scherpe keuzes. In Positionr zit dezelfde manier van denken.",
    linkedInUrl: "https://www.linkedin.com/in/dehaasmartijn/",
    photoSrc: "/founders/martijn.png",
  },
];

function Avatar({ f }: { f: Founder }) {
  if (f.photoSrc) {
    return (
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-white/80">
        <Image
          src={f.photoSrc}
          alt={`Portret van ${f.name}`}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-2xl font-bold text-primary ring-2 ring-white/80"
      aria-label={f.name}
    >
      {f.initials}
    </div>
  );
}

export function Founders() {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
      <div className="mb-12 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Achter Positionr.
        </div>
        <h2
          className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          De ervaring die AI niet kan namaken.
        </h2>
        <p className="mt-4 text-lg text-ink-mid">
          Positionr is geen zwarte doos vol algoritmes. Elke module is gebouwd
          door twee marketeers die dertig jaar aan cases, missers en succesvolle
          keuzes hebben gecodificeerd. Wat je terugkrijgt is hún manier van
          denken, niet die van de machine.
        </p>
      </div>

      <div
        ref={ref}
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        {FOUNDERS.map((f, i) => (
          <motion.div
            key={f.name}
            initial={{ opacity: 0, y: 12 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{
              type: "spring",
              bounce: 0,
              duration: 0.35,
              delay: i * 0.08,
            }}
            className="rounded-2xl bg-white p-6 shadow-sm shadow-black/5 md:p-8"
          >
            <div className="flex items-start gap-4">
              <Avatar f={f} />
              <div className="min-w-0">
                <div className="font-display text-xl font-bold text-ink-high">
                  {f.name}
                </div>
                <div className="text-sm text-ink-mid">{f.role}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-ink-mut">
                  {f.yearsPractice}
                </div>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-ink-mid">
              {f.intro}
            </p>
            {f.linkedInUrl && (
              <a
                href={f.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Linkedin size={13} />
                LinkedIn
              </a>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
