"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";

const QA = [
  {
    q: "Kan ik dit ook zonder marketing-achtergrond gebruiken?",
    a: "Ja. De rapportages leggen uit wat je ziet en welke acties je kunt nemen. Je hoeft geen marketing-jargon te kennen. We schrijven voor ondernemers, niet voor marketeers.",
  },
  {
    q: "Wat gebeurt er met mijn data?",
    a: "Je data blijft van jou. Analyses staan in je eigen account, we verkopen niets aan derden en verwijderen alles bij opzegging.",
  },
  {
    q: "Werkt dit ook voor mijn sector?",
    a: "Positionr is gebouwd voor B2B-MKB in zakelijke dienstverlening, technologie en financiële dienstverlening. Buiten die sectoren werkt het ook, maar de raamwerken zijn dáár het beste getest.",
  },
  {
    q: "Kan ik opzeggen?",
    a: "Je koopt een jaar toegang. Aan het einde loopt de licentie vanzelf af. Geen automatische verlenging, geen kleine lettertjes.",
  },
  {
    q: "Hoe verhoudt Positionr zich tot mijn huidige bureau?",
    a: "Positionr vervangt je bureau niet noodzakelijk. Het geeft je een onafhankelijke second opinion en helpt bepalen waarop je bureau moet focussen.",
  },
  {
    q: "Wat als ik meer hulp nodig heb dan de tool geeft?",
    a: "Neem contact op. We denken graag mee, of verwijzen je naar een specialist uit ons netwerk als dat beter past.",
  },
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="mb-8 font-display text-3xl font-bold text-ink-high md:text-4xl">
        Wat vragen mensen ons vaak?
      </h2>
      <div>
        {QA.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="border-b border-black/[0.08]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-[17px] font-medium text-ink-high">
                  {item.q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="shrink-0 text-ink-mut"
                >
                  <ChevronRight size={18} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 pr-8 text-ink-mid">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
