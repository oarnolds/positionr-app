"use client";

import { useState, useTransition } from "react";
import { Globe, FileText, ClipboardList, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startSnelAnalyse,
  startMarkdownAnalyse,
} from "@/app/(app)/modules/icp-analyse/actions";

export type SnapshotOption = { id: string; label: string };

export function ModeSelector({
  productId,
  snapshots = [],
}: {
  productId: string;
  snapshots?: SnapshotOption[];
}) {
  const [mode, setMode] = useState<"website" | "markdown">("website");
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const markdownReady = snapshots.length > 0;
  const startDisabled = pending || (mode === "markdown" && !snapshotId);

  function handleStart() {
    startTransition(() => {
      if (mode === "website") {
        startSnelAnalyse(productId);
      } else {
        startMarkdownAnalyse(productId, snapshotId);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <ModeCard
          active={mode === "website"}
          onClick={() => setMode("website")}
          icon={<Globe className="h-5 w-5 text-cyan-600" />}
          title="Analyse obv website"
          subtitle="AI analyseert de website en genereert direct een ICP-profiel."
          bullets={["Klaar in ~30 sec", "Gebaseerd op live website", "Scraping inbegrepen"]}
        />
        <ModeCard
          active={mode === "markdown"}
          onClick={() => setMode("markdown")}
          icon={<FileText className="h-5 w-5 text-purple-600" />}
          title="Analyse obv markdown"
          subtitle="Gebruikt een markdown-snapshot uit je bibliotheek als invoer."
          bullets={["Klaar in ~30 sec", "Geen scraping nodig", "Kies zelf de bron"]}
        />
        <ModeCard
          active={false}
          icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
          title="Volledige analyse"
          subtitle="Website-analyse gecombineerd met vragenlijst voor scherper profiel."
          bullets={["Meest nauwkeurig", "Website + vragenlijst", "~10-15 min"]}
          comingSoon
        />
      </div>

      {mode === "markdown" ? (
        markdownReady ? (
          <div>
            <label
              htmlFor="snapshot-select"
              className="block text-sm font-semibold text-gray-700"
            >
              Kies een markdown-bron
            </label>
            <select
              id="snapshot-select"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Je bibliotheek is nog leeg. Maak eerst markdown van een website,
            PDF of Word-document op de modules-pagina.
          </p>
        )
      ) : null}

      <Button
        onClick={handleStart}
        disabled={startDisabled}
        size="lg"
        className="gap-2"
      >
        <BarChart3 className="h-5 w-5" />
        {pending ? "Bezig met analyseren..." : "Analyse starten"}
      </Button>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
  bullets,
  comingSoon,
}: {
  active: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={comingSoon}
      className={`relative rounded-2xl border-2 p-4 text-left transition ${
        comingSoon
          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
          : active
          ? "border-cyan-500 bg-cyan-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {comingSoon && (
        <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
          Binnenkort
        </span>
      )}
      <div className={`flex items-center gap-2 ${comingSoon ? "pr-20" : ""}`}>
        <div className="rounded-lg bg-white p-1.5 shadow-sm">{icon}</div>
        <span className="font-semibold text-gray-900">{title}</span>
      </div>
      <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      <ul className="mt-3 space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-xs text-gray-700">
            ✓ {b}
          </li>
        ))}
      </ul>
    </button>
  );
}
