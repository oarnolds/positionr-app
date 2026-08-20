"use client";

import { motion } from "motion/react";
import { Linkedin } from "lucide-react";
import Image from "next/image";

import { useReveal } from "./use-reveal";
import type { FoundersKey } from "./keys";

type FounderMeta = {
  initials: string;
  photoSrc: string | null;
  linkedInUrl: string | null;
  nameKey: FoundersKey;
  roleKey: FoundersKey;
  yearsKey: FoundersKey;
  introKey: FoundersKey;
};

const FOUNDER_META: readonly FounderMeta[] = [
  {
    initials: "OA",
    photoSrc: "/founders/olivier.jpg",
    linkedInUrl: "https://www.linkedin.com/in/olivierarnolds/",
    nameKey: "homepage.founders.olivier.name",
    roleKey: "homepage.founders.olivier.role",
    yearsKey: "homepage.founders.olivier.years",
    introKey: "homepage.founders.olivier.intro",
  },
  {
    initials: "MdH",
    photoSrc: "/founders/martijn.png",
    linkedInUrl: "https://www.linkedin.com/in/dehaasmartijn/",
    nameKey: "homepage.founders.martijn.name",
    roleKey: "homepage.founders.martijn.role",
    yearsKey: "homepage.founders.martijn.years",
    introKey: "homepage.founders.martijn.intro",
  },
];

function Avatar({
  initials,
  photoSrc,
  alt,
}: {
  initials: string;
  photoSrc: string | null;
  alt: string;
}) {
  if (photoSrc) {
    return (
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-white/80">
        <Image
          src={photoSrc}
          alt={`Portret van ${alt}`}
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
      aria-label={alt}
    >
      {initials}
    </div>
  );
}

export function Founders({
  content,
}: {
  content: Record<FoundersKey, string>;
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
      <div className="mb-12 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {content["homepage.founders.eyebrow"]}
        </div>
        <h2
          className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          {content["homepage.founders.title"]}
        </h2>
        <p className="mt-4 text-lg text-ink-mid">
          {content["homepage.founders.intro"]}
        </p>
      </div>

      <div ref={ref} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {FOUNDER_META.map((f, i) => {
          const name = content[f.nameKey];
          return (
            <motion.div
              key={f.nameKey}
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
                <Avatar
                  initials={f.initials}
                  photoSrc={f.photoSrc}
                  alt={name}
                />
                <div className="min-w-0">
                  <div className="font-display text-xl font-bold text-ink-high">
                    {name}
                  </div>
                  <div className="text-sm text-ink-mid">
                    {content[f.roleKey]}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-ink-mut">
                    {content[f.yearsKey]}
                  </div>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-ink-mid">
                {content[f.introKey]}
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
          );
        })}
      </div>
    </section>
  );
}
