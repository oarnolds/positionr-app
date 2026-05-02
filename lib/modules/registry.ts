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
  type LucideIcon,
} from "lucide-react";

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
};

export const MODULES: ModuleMeta[] = [
  {
    slug: "website-check",
    name: "Website Check",
    description:
      "Analyseer uw B2B-website op waardepropositie, CTA's, content en verbeterpunten.",
    icon: Globe,
    color: "from-purple-500 to-purple-700",
    borderColor: "border-purple-200",
    bgLight: "bg-purple-50",
    iconColor: "text-purple-600",
    status: "active",
    href: "/modules/website-check",
  },
  {
    slug: "website-check-concurrenten",
    name: "Website Check + Concurrenten",
    description:
      "Combineer een websiteanalyse met een benchmark van uw concurrenten.",
    icon: Globe,
    color: "from-teal-500 to-teal-700",
    borderColor: "border-teal-200",
    bgLight: "bg-teal-50",
    iconColor: "text-teal-600",
    status: "soon",
  },
  {
    slug: "flyercheck",
    name: "Flyer/Salespresentatie Checker",
    description:
      "Upload een flyer of brochure en ontvang professionele feedback op design en boodschap.",
    icon: FileImage,
    color: "from-orange-500 to-orange-700",
    borderColor: "border-orange-200",
    bgLight: "bg-orange-50",
    iconColor: "text-orange-600",
    status: "soon",
  },
  {
    slug: "marktonderzoek",
    name: "Marktonderzoek",
    description:
      "Uitgebreide marktanalyse met concurrentie, trends en strategische aanbevelingen.",
    icon: BarChart3,
    color: "from-blue-500 to-blue-700",
    borderColor: "border-blue-200",
    bgLight: "bg-blue-50",
    iconColor: "text-blue-600",
    status: "soon",
  },
  {
    slug: "linkedin-analyse",
    name: "LinkedIn Analyse",
    description:
      "Analyseer de LinkedIn-aanwezigheid van uw bedrijf op content, engagement en bereik.",
    icon: Linkedin,
    color: "from-blue-600 to-blue-800",
    borderColor: "border-blue-300",
    bgLight: "bg-blue-50",
    iconColor: "text-blue-700",
    status: "soon",
  },
  {
    slug: "linkedin-concurrentie",
    name: "LinkedIn Analyse + Concurrentie",
    description: "Vergelijk uw LinkedIn-aanwezigheid met die van uw concurrenten.",
    icon: Linkedin,
    color: "from-indigo-500 to-indigo-700",
    borderColor: "border-indigo-200",
    bgLight: "bg-indigo-50",
    iconColor: "text-indigo-600",
    status: "soon",
  },
  {
    slug: "propositie-analyse",
    name: "Propositie Analyse",
    description:
      "Analyseer de kracht van uw propositie op duidelijkheid, relevantie en onderscheidend vermogen.",
    icon: Target,
    color: "from-rose-500 to-rose-700",
    borderColor: "border-rose-200",
    bgLight: "bg-rose-50",
    iconColor: "text-rose-600",
    status: "soon",
  },
  {
    slug: "icp-analyse",
    name: "Ideale Klant (ICP) Analyse",
    description:
      "Definieer uw ideale klantprofiel op basis van firmographics, pijnpunten en koopgedrag.",
    icon: UserCheck,
    color: "from-cyan-500 to-cyan-700",
    borderColor: "border-cyan-200",
    bgLight: "bg-cyan-50",
    iconColor: "text-cyan-600",
    status: "soon",
  },
  {
    slug: "klantcase-analyse",
    name: "Klantcase Analyse",
    description:
      "Beoordeel de kwaliteit en effectiviteit van uw klantcases en referentiemarketing.",
    icon: BookOpen,
    color: "from-amber-500 to-amber-700",
    borderColor: "border-amber-200",
    bgLight: "bg-amber-50",
    iconColor: "text-amber-600",
    status: "soon",
  },
  {
    slug: "linkedin-concurrentie-kwartaal",
    name: "LinkedIn Concurrentie Laatste Kwartaal",
    description:
      "Monitor de LinkedIn-activiteit van uw concurrenten over het afgelopen kwartaal.",
    icon: TrendingUp,
    color: "from-violet-500 to-violet-700",
    borderColor: "border-violet-200",
    bgLight: "bg-violet-50",
    iconColor: "text-violet-600",
    status: "soon",
  },
  {
    slug: "gap-analyse",
    name: "Gap Analyse",
    description:
      "Identificeer de gaps tussen uw huidige en gewenste marktpositie en stel een actieplan op.",
    icon: Search,
    color: "from-slate-500 to-slate-700",
    borderColor: "border-slate-200",
    bgLight: "bg-slate-50",
    iconColor: "text-slate-600",
    status: "soon",
  },
];

export function getModule(slug: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.slug === slug);
}
