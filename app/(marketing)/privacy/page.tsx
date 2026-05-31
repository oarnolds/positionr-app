export const metadata = {
  title: "Privacy — Positionr",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-20">
      <h1>Privacyverklaring</h1>
      <p className="text-muted-foreground">
        Laatst bijgewerkt: <em>nog in te vullen</em>
      </p>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Plaatshouder:</strong> de definitieve privacyverklaring wordt
        hier nog ingevuld. Heb je nu vragen over hoe wij met je gegevens
        omgaan? Mail{" "}
        <a href="mailto:olivier@positionr.nl">olivier@positionr.nl</a>.
      </p>
      <h2>Welke gegevens verwerken we?</h2>
      <p>
        E-mailadres + bedrijfsgegevens (account), gebruiksdata van modules,
        en — bij gebruik van de gratis Website Check — het opgegeven
        e-mailadres en de gecheckte URL.
      </p>
      <h2>Waarom?</h2>
      <p>
        Om je het product te kunnen leveren (account, abonnement, analyses) en
        om met je te kunnen communiceren over je gebruik.
      </p>
      <h2>Met wie delen we het?</h2>
      <p>
        Met onze verwerkers: Supabase (database/auth), Vercel (hosting), Mollie
        (betalingen), en — wanneer geactiveerd — Resend (e-mail).
      </p>
      <h2>Hoe lang?</h2>
      <p>Tekst volgt.</p>
    </article>
  );
}
