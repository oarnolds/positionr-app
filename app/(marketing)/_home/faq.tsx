"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";

import type { FaqKey } from "./keys";

const QA: ReadonlyArray<{ qKey: FaqKey; aKey: FaqKey }> = [
  { qKey: "homepage.faq.q.1", aKey: "homepage.faq.a.1" },
  { qKey: "homepage.faq.q.2", aKey: "homepage.faq.a.2" },
  { qKey: "homepage.faq.q.3", aKey: "homepage.faq.a.3" },
  { qKey: "homepage.faq.q.4", aKey: "homepage.faq.a.4" },
  { qKey: "homepage.faq.q.5", aKey: "homepage.faq.a.5" },
  { qKey: "homepage.faq.q.6", aKey: "homepage.faq.a.6" },
];

export function Faq({ content }: { content: Record<FaqKey, string> }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="mb-8 font-display text-3xl font-bold text-ink-high md:text-4xl">
        {content["homepage.faq.title"]}
      </h2>
      <div>
        {QA.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.qKey} className="border-b border-black/[0.08]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-[17px] font-medium text-ink-high">
                  {content[item.qKey]}
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
                    <div
                      className="pb-5 pr-8 text-ink-mid [&_p]:m-0"
                      // Antwoorden zijn `rich` in de content-registry — sanitized bij save.
                      dangerouslySetInnerHTML={{ __html: content[item.aKey] }}
                    />
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
