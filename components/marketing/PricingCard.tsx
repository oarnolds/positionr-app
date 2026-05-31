import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BillingInterval, Plan } from "@/lib/plans/registry";
import { formatPeriod, formatPriceEur, priceFor } from "@/lib/plans/format";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Props = {
  plan: Plan;
  interval: BillingInterval;
};

export function PricingCard({ plan, interval }: Props) {
  const cents = priceFor(plan, interval);
  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        plan.popular && "border-primary shadow-lg ring-2 ring-primary/20",
      )}
    >
      <CardHeader>
        {plan.popular && (
          <div className="mb-2 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Populair
          </div>
        )}
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">{formatPriceEur(cents)}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {formatPeriod(interval)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Link
          href={`/checkout?plan=${plan.slug}&interval=${interval}`}
          className="w-full"
        >
          <Button
            variant={plan.popular ? "default" : "outline"}
            className="w-full"
            size="lg"
          >
            Kies {plan.name}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
