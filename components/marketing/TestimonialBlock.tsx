/**
 * Klantcitaat-blok. Op dit moment plaatshouder-content — duidelijk gemarkeerd
 * met "Voorbeeld" zodat een bezoeker niet wordt misleid. Vervang door echt
 * citaat + foto + naam zodra een design-partner toestemt.
 */
import { Quote } from "lucide-react";

export function TestimonialBlock() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <Quote className="h-10 w-10 text-primary" />
        <blockquote className="mt-6 text-2xl font-medium leading-relaxed text-slate-900 sm:text-3xl">
          "In tien minuten wist ik wat een marketingbureau me in een
          ochtend-sessie had verteld — alleen scherper, met de cijfers erbij.
          Eindelijk een tool die geen flauwekul verkoopt."
        </blockquote>
        <div className="mt-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            JD
          </div>
          <div>
            <div className="font-semibold text-slate-900">Jan de Vries</div>
            <div className="text-sm text-slate-500">
              Oprichter · Voorbeeldbedrijf
            </div>
          </div>
          <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            Voorbeeld — wordt vervangen
          </span>
        </div>
      </div>
    </section>
  );
}
