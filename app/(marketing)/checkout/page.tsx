import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getPlan, type Tier } from "@/lib/plans/registry";
import { formatPriceEur } from "@/lib/plans/format";

export const metadata = {
  title: "Afrekenen — Positionr",
};

type SearchParams = { plan?: string };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const plan = params.plan ? getPlan(params.plan as Tier) : undefined;

  if (!plan) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">Geen abonnement gekozen</h1>
        <p className="mt-4 text-muted-foreground">
          We kunnen je gekozen abonnement niet vinden. Kies er een op de
          prijzenpagina.
        </p>
        <div className="mt-8">
          <Link href="/prijzen">
            <Button size="lg">Naar prijzen</Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Afrekenen — bijna klaar</h1>
      <div className="mt-8 rounded-xl border border-border bg-white p-8 text-left shadow-sm">
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Abonnement</dt>
            <dd className="font-medium">{plan.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Periode</dt>
            <dd className="font-medium">12 maanden toegang</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="text-muted-foreground">Eenmalig</dt>
            <dd className="text-lg font-semibold">
              {formatPriceEur(plan.yearlyPriceCents)}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Binnenkort:</strong> betalen via Mollie wordt nog ingebouwd
        (volgt in de eerstvolgende update). Je krijgt dan automatisch een
        account en een inloglink per mail.
      </p>

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/prijzen">
          <Button variant="outline" size="lg">
            Terug naar prijzen
          </Button>
        </Link>
      </div>
    </section>
  );
}
