"use client";

import type { BillingInterval } from "@/lib/plans/registry";
import { cn } from "@/lib/utils";

type Props = {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
};

export function BillingToggle({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Betalingsperiode"
      className="inline-flex rounded-full border border-border bg-muted p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition",
          value === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Per maand
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "yearly"}
        onClick={() => onChange("yearly")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition",
          value === "yearly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Per jaar <span className="ml-1 text-xs text-primary">bespaar</span>
      </button>
    </div>
  );
}
