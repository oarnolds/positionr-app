/**
 * Drie-stappen-uitleg "Zo werkt het". Numbered cards, scanbaar.
 */

const steps = [
  {
    number: "01",
    title: "Vul je URL in",
    description:
      "Geen account, geen creditcard. Alleen je e-mail en je website-adres.",
  },
  {
    number: "02",
    title: "Krijg je score in minuten",
    description:
      "Onze AI leest je site door de bril van een ervaren marketeer. Score, sterke punten, verbeterpunten — direct op je scherm.",
  },
  {
    number: "03",
    title: "Neem het besluit",
    description:
      "Concrete top-acties die je vandaag nog kunt doen. Geen vaag advies, geen vervolggesprek nodig.",
  },
];

export function StepsSection() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Zo werkt het
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Van vraag naar besluit in minuten
          </h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number}>
              <div className="text-3xl font-bold tracking-tight text-primary">
                {step.number}
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
