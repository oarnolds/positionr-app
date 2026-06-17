import type { ReactNode } from "react";

export function ReportShell({ children }: { children: ReactNode }) {
  const today = new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {children}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-10 py-3 text-xs text-slate-500">
        <span>Positionr · Website analyse</span>
        <span>Gegenereerd {today}</span>
      </footer>
    </article>
  );
}
