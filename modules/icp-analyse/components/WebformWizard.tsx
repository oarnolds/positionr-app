"use client";

import { useState, useTransition } from "react";
import {
  Users,
  Zap,
  Star,
  Target,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveWebformStep,
  submitWebform,
} from "@/app/(app)/modules/icp-analyse/actions";
import {
  SECTORS,
  HOOFDSECTOREN,
  BEDRIJFSGROOTTES,
  VINDKANALEN,
} from "@/modules/icp-analyse/sectors";
import type { WebformAnswers } from "@/modules/icp-analyse/schema";

type Answers = Partial<WebformAnswers>;

const BLOCKS = [
  { id: 1, title: "Wie is je ideale klant?", icon: Users },
  { id: 2, title: "Pijnpunten & Triggers", icon: Zap },
  { id: 3, title: "Dienst & Waarde", icon: Star },
  { id: 4, title: "Kenmerken & Dealbreakers", icon: Target },
  { id: 5, title: "Bereikbaarheid & USP", icon: MapPin },
] as const;

export function WebformWizard({
  productId,
  sessionId,
  productName,
  initial,
  initialStep,
}: {
  productId: string;
  sessionId: string;
  productName: string;
  initial: Answers;
  initialStep: number;
}) {
  const [block, setBlock] = useState<number>(
    Math.max(1, Math.min(5, initialStep || 1))
  );
  const [answers, setAnswers] = useState<Answers>({
    sectoren: initial.sectoren ?? [],
    bedrijfsgrootte: initial.bedrijfsgrootte ?? [],
    contactfunctie: initial.contactfunctie ?? "",
    beslisser: initial.beslisser ?? "",
    zelfdePersoon: initial.zelfdePersoon ?? true,
    pijnpunt: initial.pijnpunt ?? "",
    triggers: initial.triggers ?? [],
    strategischeDienst: initial.strategischeDienst ?? productName,
    contractwaarde: initial.contractwaarde ?? "",
    idealeKenmerken: initial.idealeKenmerken ?? [],
    dealbreakers: initial.dealbreakers ?? [],
    vindkanalen: initial.vindkanalen ?? [],
    usp: initial.usp ?? "",
    eigenBeschrijving: initial.eigenBeschrijving ?? "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function persist() {
    setError(null);
    try {
      await saveWebformStep(sessionId, answers, block);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt");
    }
  }

  async function next() {
    await persist();
    if (block < 5) setBlock(block + 1);
  }
  async function prev() {
    await persist();
    if (block > 1) setBlock(block - 1);
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        await submitWebform(productId, sessionId, answers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Genereren mislukt");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex flex-wrap gap-2">
        {BLOCKS.map((b) => {
          const Icon = b.icon;
          const isActive = b.id === block;
          const isDone = b.id < block;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBlock(b.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                isActive
                  ? "bg-cyan-600 text-white"
                  : isDone
                  ? "bg-cyan-100 text-cyan-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {b.id}. {b.title}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Blocks */}
      {block === 1 && (
        <Block title={BLOCKS[0].title}>
          {/* Sectoren */}
          <Field label="Sectoren waarin de ideale klant actief is">
            <SectorPicker
              value={answers.sectoren ?? []}
              onChange={(v) => update("sectoren", v)}
            />
          </Field>
          {/* Bedrijfsgrootte */}
          <Field label="Bedrijfsgrootte (meerdere mogelijk)">
            <ChipMulti
              options={BEDRIJFSGROOTTES}
              value={answers.bedrijfsgrootte ?? []}
              onChange={(v) => update("bedrijfsgrootte", v)}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Contactfunctie (wie zoekt eerst contact?)">
              <Input
                value={answers.contactfunctie ?? ""}
                onChange={(e) => update("contactfunctie", e.target.value)}
                placeholder="bv. Hoofd Operations"
              />
            </Field>
            <Field label="Beslisser (wie tekent uiteindelijk?)">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={answers.zelfdePersoon ?? true}
                    onChange={(e) =>
                      update("zelfdePersoon", e.target.checked)
                    }
                  />
                  Zelfde persoon als contactfunctie
                </label>
                {!answers.zelfdePersoon && (
                  <Input
                    value={answers.beslisser ?? ""}
                    onChange={(e) => update("beslisser", e.target.value)}
                    placeholder="bv. CFO"
                  />
                )}
              </div>
            </Field>
          </div>
        </Block>
      )}

      {block === 2 && (
        <Block title={BLOCKS[1].title}>
          <Field label="Primair pijnpunt — wat is HET probleem dat je oplost?">
            <textarea
              value={answers.pijnpunt ?? ""}
              onChange={(e) => update("pijnpunt", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="bv. compliance-rapportages kosten 4 dagen/maand handmatig werk"
            />
          </Field>
          <Field label="Trigger events — wat zet de klant aan tot kopen?">
            <ChipFreeform
              value={answers.triggers ?? []}
              onChange={(v) => update("triggers", v)}
              placeholder="bv. Nieuwe AVG-uitvoeringswet"
            />
          </Field>
        </Block>
      )}

      {block === 3 && (
        <Block title={BLOCKS[2].title}>
          <Field label="Strategische dienst (welk product/dienst staat centraal?)">
            <Input
              value={answers.strategischeDienst ?? ""}
              onChange={(e) => update("strategischeDienst", e.target.value)}
            />
          </Field>
          <Field label="Contractwaarde">
            <Input
              value={answers.contractwaarde ?? ""}
              onChange={(e) => update("contractwaarde", e.target.value)}
              placeholder="bv. €5k-15k/jaar SaaS"
            />
          </Field>
        </Block>
      )}

      {block === 4 && (
        <Block title={BLOCKS[3].title}>
          <Field label="Ideale kenmerken — wat maakt iemand een geweldige klant?">
            <ChipFreeform
              value={answers.idealeKenmerken ?? []}
              onChange={(v) => update("idealeKenmerken", v)}
              placeholder="bv. al digitaal-volwassen"
            />
          </Field>
          <Field label="Dealbreakers — wanneer is het GEEN match?">
            <ChipFreeform
              value={answers.dealbreakers ?? []}
              onChange={(v) => update("dealbreakers", v)}
              placeholder="bv. geen IT-budget"
              variant="warning"
            />
          </Field>
        </Block>
      )}

      {block === 5 && (
        <Block title={BLOCKS[4].title}>
          <Field label="Vindkanalen (sleep om te prioriteren)">
            <VindkanalenPicker
              value={answers.vindkanalen ?? []}
              onChange={(v) => update("vindkanalen", v)}
            />
          </Field>
          <Field label="USP — wat is jullie unique selling point?">
            <textarea
              value={answers.usp ?? ""}
              onChange={(e) => update("usp", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="bv. enige aanbieder met native AVG-templates"
            />
          </Field>
          <Field label="Eigen beschrijving (optioneel)">
            <textarea
              value={answers.eigenBeschrijving ?? ""}
              onChange={(e) => update("eigenBeschrijving", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Vrije aanvulling — alles wat de AI nog moet weten"
            />
          </Field>
        </Block>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <Button variant="outline" onClick={prev} disabled={block === 1}>
          <ChevronLeft className="h-4 w-4" />
          Vorige
        </Button>

        {block < 5 ? (
          <Button onClick={next}>
            Volgende
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={generate} disabled={pending} size="lg">
            {pending ? "ICP genereren..." : "Genereer ICP-profiel"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SectorPicker({
  value,
  onChange,
}: {
  value: { hoofdsector: string; subsector: string }[];
  onChange: (v: { hoofdsector: string; subsector: string }[]) => void;
}) {
  const [hoofd, setHoofd] = useState("");
  const [sub, setSub] = useState("");

  function add() {
    if (!hoofd || !sub) return;
    if (
      value.some(
        (s) => s.hoofdsector === hoofd && s.subsector === sub
      )
    )
      return;
    onChange([...value, { hoofdsector: hoofd, subsector: sub }]);
    setSub("");
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          value={hoofd}
          onChange={(e) => {
            setHoofd(e.target.value);
            setSub("");
          }}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Hoofdsector...</option>
          {HOOFDSECTOREN.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          disabled={!hoofd}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
        >
          <option value="">Subsector...</option>
          {hoofd &&
            SECTORS[hoofd]?.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!hoofd || !sub}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Toevoegen
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((s, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-900"
            >
              {s.hoofdsector} · {s.subsector}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-blue-700 hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChipMulti({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              on
                ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ChipFreeform({
  value,
  onChange,
  placeholder,
  variant = "default",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  variant?: "default" | "warning";
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setInput("");
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function keydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  const chipColor =
    variant === "warning"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-gray-200 bg-gray-50 text-gray-800";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={keydown}
          placeholder={placeholder}
        />
        <Button
          variant="outline"
          onClick={add}
          disabled={!input.trim()}
          size="default"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <li
              key={i}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${chipColor}`}
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                className="hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VindkanalenPicker({
  value,
  onChange,
}: {
  value: { kanaal: string; prioriteit: number }[];
  onChange: (v: { kanaal: string; prioriteit: number }[]) => void;
}) {
  function toggle(kanaal: string) {
    const idx = value.findIndex((v) => v.kanaal === kanaal);
    if (idx >= 0) {
      onChange(value.filter((v) => v.kanaal !== kanaal));
    } else {
      onChange([...value, { kanaal, prioriteit: value.length + 1 }]);
    }
  }

  function move(kanaal: string, dir: -1 | 1) {
    const idx = value.findIndex((v) => v.kanaal === kanaal);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= value.length) return;
    const arr = [...value];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange(arr.map((v, i) => ({ ...v, prioriteit: i + 1 })));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Selecteer kanalen die werken voor jullie:</p>
      <div className="flex flex-wrap gap-1.5">
        {VINDKANALEN.map((k) => {
          const on = value.some((v) => v.kanaal === k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={`rounded-full border px-3 py-1 text-xs ${
                on
                  ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Geselecteerd (op prioriteit):
          </p>
          <ol className="mt-1 space-y-1">
            {value.map((v) => (
              <li
                key={v.kanaal}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
              >
                <span>
                  <span className="mr-2 font-bold text-cyan-700">
                    #{v.prioriteit}
                  </span>
                  {v.kanaal}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(v.kanaal, -1)}
                    className="rounded border border-gray-200 px-1.5 hover:bg-gray-50"
                    aria-label="Hoger"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(v.kanaal, 1)}
                    className="rounded border border-gray-200 px-1.5 hover:bg-gray-50"
                    aria-label="Lager"
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
