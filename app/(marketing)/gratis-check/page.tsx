import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startFreeCheck } from "./actions";

export const metadata = {
  title: "Gratis Website Check — Positionr",
};

export default function GratisCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <section className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-center text-4xl font-bold">Gratis Website Check</h1>
      <p className="mt-4 text-center text-muted-foreground">
        Geef je e-mail en website-URL — binnen een minuut zie je een score met
        concrete verbeterpunten.
      </p>

      <ErrorBox searchParams={searchParams} />

      <form
        action={startFreeCheck}
        className="mt-8 space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="jij@bedrijf.nl"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="websiteUrl" className="text-sm font-medium">
            Website
          </label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            required
            placeholder="https://www.jouwbedrijf.nl"
            className="mt-1"
          />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Start gratis analyse
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We mailen je niet ongevraagd. Door dit te versturen ga je akkoord met
          ons <a href="/privacy" className="underline">privacybeleid</a>.
        </p>
      </form>
    </section>
  );
}

async function ErrorBox({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      {error}
    </div>
  );
}
