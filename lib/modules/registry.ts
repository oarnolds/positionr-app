/**
 * Source-of-truth voor de module-catalogus.
 *
 * Dit is een statische lijst voor de UI (welke kaarten te tonen).
 * De DB-tabel `modules` bevat de runtime-data (default prompt, status).
 * Bij seed wordt deze lijst in de DB ingeladen.
 */

import {
  Globe,
  BarChart3,
  FileImage,
  Linkedin,
  Target,
  UserCheck,
  BookOpen,
  TrendingUp,
  Search,
  Compass,
  MessageSquare,
  Phone,
  CalendarDays,
  CalendarRange,
  Lightbulb,
  Swords,
  Users,
  Crosshair,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";

import type { Tier } from "@/lib/plans/registry";

export type ModuleStatus = "active" | "soon" | "disabled";

export type ModuleMeta = {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string; // tailwind gradient classes
  borderColor: string;
  bgLight: string;
  iconColor: string;
  status: ModuleStatus;
  /** Pad naar de module-pagina (alleen voor active modules) */
  href?: string;
  /** Minimaal vereiste tier voor toegang (cumulatief). */
  minTier: Tier;
  /**
   * Slug van de "parent"-module bij sub-prompts.
   * Sub-prompts zijn admin-bewerkbare prompt-entries die bij een echte module horen
   * (bv. ICP heeft 3 prompt-fases). Sub-prompts:
   *  - verschijnen WEL in de admin-prompt-editor
   *  - verschijnen NIET in de marketing-matrix of de portal-modules-catalog
   *
   * Consumenten filteren met `m.parentSlug == null` voor top-level lijsten.
   */
  parentSlug?: string;
};

export const MODULES: ModuleMeta[] = [
  // ── Fundament (7) ─────────────────────────────────────────────────
  {
    slug: "website-check",
    name: "Website check",
    description:
      "Analyseer je B2B-website op waardepropositie, CTA's, content en verbeterpunten.",
    icon: Globe,
    color: "from-purple-500 to-purple-700",
    borderColor: "border-purple-200",
    bgLight: "bg-purple-50",
    iconColor: "text-purple-600",
    status: "active",
    href: "/modules/website-check",
    minTier: "fundament",
  },
  {
    slug: "linkedin-analyse",
    name: "LinkedIn analyse",
    description:
      "Analyseer de LinkedIn-aanwezigheid van je bedrijf op content, engagement en bereik.",
    icon: Linkedin,
    color: "from-blue-600 to-blue-800",
    borderColor: "border-blue-300",
    bgLight: "bg-blue-50",
    iconColor: "text-blue-700",
    status: "soon",
    minTier: "fundament",
  },
  {
    slug: "markttrends-rapport",
    name: "Markttrends rapport",
    description:
      "Inzicht in de actuele trends en ontwikkelingen in jouw markt.",
    icon: BarChart3,
    color: "from-blue-500 to-blue-700",
    borderColor: "border-blue-200",
    bgLight: "bg-blue-50",
    iconColor: "text-blue-600",
    status: "soon",
    minTier: "fundament",
  },
  {
    slug: "flyercheck",
    name: "Flyer/Salespresentatie analyse",
    description:
      "Upload een flyer of salespresentatie en ontvang feedback op design en boodschap.",
    icon: FileImage,
    color: "from-orange-500 to-orange-700",
    borderColor: "border-orange-200",
    bgLight: "bg-orange-50",
    iconColor: "text-orange-600",
    status: "soon",
    minTier: "fundament",
  },
  {
    slug: "klantcase-analyse",
    name: "Klantcase analyse",
    description:
      "Beoordeel de kwaliteit en effectiviteit van je klantcases en referentiemarketing.",
    icon: BookOpen,
    color: "from-amber-500 to-amber-700",
    borderColor: "border-amber-200",
    bgLight: "bg-amber-50",
    iconColor: "text-amber-600",
    status: "active",
    href: "/modules/klantcase-analyse",
    minTier: "fundament",
  },
  {
    slug: "propositie-analyse",
    name: "Propositie analyse",
    description:
      "Analyseer de kracht van je propositie op duidelijkheid, relevantie en onderscheidend vermogen.",
    icon: Target,
    color: "from-rose-500 to-rose-700",
    borderColor: "border-rose-200",
    bgLight: "bg-rose-50",
    iconColor: "text-rose-600",
    status: "active",
    href: "/modules/propositie-analyse",
    minTier: "fundament",
  },
  {
    slug: "icp-analyse",
    name: "Ideale klant analyse",
    description:
      "Definieer je ideale klantprofiel op basis van firmographics, pijnpunten en koopgedrag.",
    icon: UserCheck,
    color: "from-cyan-500 to-cyan-700",
    borderColor: "border-cyan-200",
    bgLight: "bg-cyan-50",
    iconColor: "text-cyan-600",
    status: "active",
    href: "/modules/icp-analyse",
    minTier: "fundament",
  },

  // ── Groei (+7) ────────────────────────────────────────────────────
  {
    slug: "website-check-concurrenten",
    name: "Website analyse + concurrenten",
    description:
      "Combineer je websiteanalyse met een benchmark tegenover je concurrenten.",
    icon: Globe,
    color: "from-teal-500 to-teal-700",
    borderColor: "border-teal-200",
    bgLight: "bg-teal-50",
    iconColor: "text-teal-600",
    status: "active",
    href: "/modules/website-check-concurrenten",
    minTier: "groei",
  },
  {
    slug: "linkedin-concurrentie",
    name: "LinkedIn analyse + concurrentie",
    description:
      "Vergelijk je LinkedIn-aanwezigheid met die van je concurrenten.",
    icon: Linkedin,
    color: "from-indigo-500 to-indigo-700",
    borderColor: "border-indigo-200",
    bgLight: "bg-indigo-50",
    iconColor: "text-indigo-600",
    status: "soon",
    minTier: "groei",
  },
  {
    slug: "markttrends-benefits",
    name: "Markttrends met benefits",
    description:
      "Vertaal markttrends naar concrete kansen en voordelen voor je bedrijf.",
    icon: TrendingUp,
    color: "from-emerald-500 to-emerald-700",
    borderColor: "border-emerald-200",
    bgLight: "bg-emerald-50",
    iconColor: "text-emerald-600",
    status: "soon",
    minTier: "groei",
  },
  {
    slug: "features-naar-benefits",
    name: "Features naar benefits",
    description:
      "Vertaal kenmerken van je product naar begrijpelijke voordelen voor je klant.",
    icon: Lightbulb,
    color: "from-yellow-500 to-yellow-700",
    borderColor: "border-yellow-200",
    bgLight: "bg-yellow-50",
    iconColor: "text-yellow-600",
    status: "soon",
    minTier: "groei",
  },
  {
    slug: "concurrentie-analyse",
    name: "Concurrentie analyse",
    description:
      "Diepere analyse van je concurrenten op propositie, prijs en aanwezigheid.",
    icon: Swords,
    color: "from-red-500 to-red-700",
    borderColor: "border-red-200",
    bgLight: "bg-red-50",
    iconColor: "text-red-600",
    status: "soon",
    minTier: "groei",
  },
  {
    slug: "doelgroep-persona",
    name: "Doelgroep & buying persona",
    description:
      "Definieer wie je klant precies is en hoe hij koopbeslissingen neemt.",
    icon: Users,
    color: "from-sky-500 to-sky-700",
    borderColor: "border-sky-200",
    bgLight: "bg-sky-50",
    iconColor: "text-sky-600",
    status: "soon",
    minTier: "groei",
  },
  {
    slug: "propositie-positionering",
    name: "Propositie en positionering",
    description:
      "Een onderscheidende positionering ten opzichte van concurrenten.",
    icon: Crosshair,
    color: "from-fuchsia-500 to-fuchsia-700",
    borderColor: "border-fuchsia-200",
    bgLight: "bg-fuchsia-50",
    iconColor: "text-fuchsia-600",
    status: "soon",
    minTier: "groei",
  },

  // ── Strategie (+7) ────────────────────────────────────────────────
  {
    slug: "marketingstrategie",
    name: "Marketingstrategie",
    description:
      "Een 12-maandsstrategie voor je marketing- en salesinzet.",
    icon: Compass,
    color: "from-violet-500 to-violet-700",
    borderColor: "border-violet-200",
    bgLight: "bg-violet-50",
    iconColor: "text-violet-600",
    status: "soon",
    minTier: "strategie",
  },
  {
    slug: "salestriggervragen",
    name: "Salestriggervragen",
    description:
      "Krachtige vragen die salesgesprekken openen en kwalificeren.",
    icon: MessageSquare,
    color: "from-pink-500 to-pink-700",
    borderColor: "border-pink-200",
    bgLight: "bg-pink-50",
    iconColor: "text-pink-600",
    status: "soon",
    minTier: "strategie",
  },
  {
    slug: "telemarketing-script",
    name: "Template telemarketing-script",
    description:
      "Beproefd belscript voor outbound campagnes naar je doelgroep.",
    icon: Phone,
    color: "from-lime-500 to-lime-700",
    borderColor: "border-lime-200",
    bgLight: "bg-lime-50",
    iconColor: "text-lime-600",
    status: "soon",
    minTier: "strategie",
  },
  {
    slug: "kwartaalplan",
    name: "Kwartaalplan Marketing & Sales",
    description:
      "Concrete focus en prioriteiten voor de komende drie maanden.",
    icon: CalendarRange,
    color: "from-blue-500 to-blue-700",
    borderColor: "border-blue-200",
    bgLight: "bg-blue-50",
    iconColor: "text-blue-600",
    status: "soon",
    minTier: "strategie",
  },
  {
    slug: "seo-quickscan",
    name: "SEO quick scan",
    description:
      "Snelle check op de vindbaarheid van je site in zoekmachines.",
    icon: Search,
    color: "from-slate-500 to-slate-700",
    borderColor: "border-slate-200",
    bgLight: "bg-slate-50",
    iconColor: "text-slate-600",
    status: "soon",
    minTier: "strategie",
  },
  {
    slug: "sea-quickscan",
    name: "SEA quick scan",
    description:
      "Quick scan van je betaalde-zoekcampagnes en hun rendement.",
    icon: MousePointerClick,
    color: "from-orange-400 to-orange-600",
    borderColor: "border-orange-200",
    bgLight: "bg-orange-50",
    iconColor: "text-orange-500",
    status: "soon",
    minTier: "strategie",
  },
  {
    slug: "content-kalender",
    name: "Content kalender",
    description:
      "Vooruitkijkende contentplanning voor je kanalen en doelgroepen.",
    icon: CalendarDays,
    color: "from-teal-500 to-teal-700",
    borderColor: "border-teal-200",
    bgLight: "bg-teal-50",
    iconColor: "text-teal-600",
    status: "soon",
    minTier: "strategie",
  },

  // ── ICP sub-extensies (admin-bewerkbaar, verschijnen onder parent) ──
  // Worden geconcateneerd na de parent-prompt (icp-analyse) op runtime.
  // De producten-scan-stap is niet admin-bewerkbaar — die staat hardcoded
  // in modules/icp-analyse/prompt.ts (FALLBACK_PROMPT_SCAN).
  {
    slug: "icp-analyse-phase1",
    name: "ICP Snelle analyse",
    description:
      "Extensie op de Ideale-klant-analyse-prompt voor de Snelle modus (website-content alleen).",
    icon: UserCheck,
    color: "from-cyan-500 to-cyan-700",
    borderColor: "border-cyan-200",
    bgLight: "bg-cyan-50",
    iconColor: "text-cyan-600",
    status: "active",
    minTier: "fundament",
    parentSlug: "icp-analyse",
  },
  {
    slug: "icp-analyse-final",
    name: "ICP Volledige Analyse",
    description:
      "Extensie op de Ideale-klant-analyse-prompt voor de Volledige modus (met webform-data).",
    icon: UserCheck,
    color: "from-cyan-500 to-cyan-700",
    borderColor: "border-cyan-200",
    bgLight: "bg-cyan-50",
    iconColor: "text-cyan-600",
    status: "active",
    minTier: "fundament",
    parentSlug: "icp-analyse",
  },
];

export function getModule(slug: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.slug === slug);
}
