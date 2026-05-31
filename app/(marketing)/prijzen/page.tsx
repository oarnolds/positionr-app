import { PricingSection } from "@/components/marketing/PricingSection";

export const metadata = {
  title: "Prijzen — Positionr",
};

export default function PrijzenPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold">Kies je abonnement</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Drie tiers, allemaal gratis op te zeggen. Kies maand of jaar — jaar is
          voordeliger.
        </p>
      </section>

      <PricingSection />

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center text-sm text-muted-foreground">
        <p>
          Vragen? Mail{" "}
          <a
            href="mailto:olivier@positionr.nl"
            className="text-primary hover:underline"
          >
            olivier@positionr.nl
          </a>
          .
        </p>
      </section>
    </>
  );
}
