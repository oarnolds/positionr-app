// Gedeelde rapport-bouwstenen in de ICP-designtaal.
// Gebruikt door FinalIcpView (ICP) en GenericReportView (generieke runner)
// zodat alle module-rapporten dezelfde visuele stijl delen.

export type ReportAccent =
  | "purple"
  | "blue"
  | "amber"
  | "green"
  | "red"
  | "indigo"
  | "teal";

// Volledige class-strings per accent — Tailwind kan geen dynamische
// classnames genereren, dus elk accent staat hier letterlijk uitgeschreven.
export const ACCENTS: Record<
  ReportAccent,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconText: string;
    chip: string;
  }
> = {
  purple: {
    border: "border-purple-200",
    bg: "bg-purple-50",
    iconBg: "bg-purple-100",
    iconText: "text-purple-700",
    chip: "border-purple-200 bg-purple-50 text-purple-900",
  },
  blue: {
    border: "border-blue-200",
    bg: "bg-white",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    chip: "border-blue-200 bg-blue-50 text-blue-900",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-white",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    chip: "border-amber-200 bg-amber-50 text-amber-900",
  },
  green: {
    border: "border-green-200",
    bg: "bg-white",
    iconBg: "bg-green-100",
    iconText: "text-green-700",
    chip: "border-green-200 bg-green-50 text-green-900",
  },
  red: {
    border: "border-red-200",
    bg: "bg-white",
    iconBg: "bg-red-100",
    iconText: "text-red-700",
    chip: "border-red-200 bg-red-50 text-red-900",
  },
  indigo: {
    border: "border-indigo-200",
    bg: "bg-white",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-900",
  },
  teal: {
    border: "border-teal-200",
    bg: "bg-white",
    iconBg: "bg-teal-100",
    iconText: "text-teal-700",
    chip: "border-teal-200 bg-teal-50 text-teal-900",
  },
};

export function Section({
  accent,
  icon,
  title,
  eyebrow,
  children,
}: {
  accent: ReportAccent;
  icon: React.ReactNode;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <section className={`rounded-2xl border ${a.border} ${a.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-lg ${a.iconBg} p-1.5 ${a.iconText}`}>
          {icon}
        </span>
        {eyebrow ? (
          <span
            className={`text-xs font-bold uppercase tracking-wide ${a.iconText}`}
          >
            {eyebrow}
          </span>
        ) : (
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value || "—"}</dd>
    </div>
  );
}

export function Chip({
  accent,
  icon,
  children,
}: {
  accent: ReportAccent;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${ACCENTS[accent].chip}`}
    >
      {icon}
      {children}
    </span>
  );
}
