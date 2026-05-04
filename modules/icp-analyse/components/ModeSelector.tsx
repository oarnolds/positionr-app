"use client";

import { useState, useTransition } from "react";
import { Zap, ClipboardList, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startSnelAnalyse } from "@/app/(app)/modules/icp-analyse/actions";

export function ModeSelector({ productId }: { productId: string }) {
  const [mode, setMode] = useState<"snel" | "volledig">("snel");
  const [pending, startTransition] = useTransition();

  function handleStart() {
    if (mode === "snel") {
      startTransition(() => {
        startSnelAnalyse(productId);
      });
    } else {
      // B2 — placeholder
      alert(
        "Volledige analyse (met vragenlijst) komt in de volgende fase. Kies voor nu Snelle analyse."
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ModeCard
          active={mode === "snel"}
          onClick={() => setMode("snel")}
          icon={<Zap className="h-5 w-5 text-cyan-600" />}
          title="Snelle analyse"
          subtitle="AI analyseert de website en genereert direct een ICP-profiel."
          bullets={["Klaar in ~30 sec", "Gebaseerd op website", "Minder diepgaand"]}
        />
        <ModeCard
          active={mode === "volledig"}
          onClick={() => setMode("volledig")}
          icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
          title="Volledige analyse"
          subtitle="Website-analyse gecombineerd met vragenlijst voor scherper profiel."
          bullets={["Meest nauwkeurig", "Website + vragenlijst", "~10-15 min"]}
          comingSoon
        />
      </div>

      <Button
        onClick={handleStart}
        disabled={pending}
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
  onClick: () => void;
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
      className={`relative rounded-2xl border-2 p-4 text-left transition ${
        active
          ? "border-cyan-500 bg-cyan-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {comingSoon && (
        <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
          Binnenkort
        </span>
      )}
      <div className="flex items-center gap-2">
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
