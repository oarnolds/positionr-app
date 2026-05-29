import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import type { Tier } from "./registry";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export type SubscriptionState = {
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
};

/**
 * Pure bepaling: welke tier geeft dit abonnement NU? null = geen toegang.
 * Actief = status 'active' EN periode-einde strikt na `now`.
 * Dekt zowel maand (status bijgewerkt door webhook) als jaar (verloopt op datum).
 */
export function activeTier(sub: SubscriptionState, now: Date): Tier | null {
  if (sub.status !== "active") return null;
  if (sub.currentPeriodEnd.getTime() <= now.getTime()) return null;
  return sub.tier;
}

/**
 * Dunne DB-wrapper: haalt het abonnement van de gebruiker op en past `activeTier` toe.
 * (Geverifieerd via de gating-smoke-test in PR 5; de logica zelf is getest in activeTier.)
 */
export async function getActiveSubscription(
  userId: string,
): Promise<{ tier: Tier } | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!row) return null;

  const tier = activeTier(
    {
      tier: row.tier,
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd,
    },
    new Date(),
  );

  return tier ? { tier } : null;
}
