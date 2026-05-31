"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { isEmailRateLimited } from "@/lib/rate-limit";
import { runFreeCheck } from "@/modules/website-check/freeCheck";

const FreeCheckInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Vul een geldig e-mailadres in."),
  websiteUrl: z
    .string()
    .trim()
    .min(3, "Vul een website in.")
    // Auto-prefix https:// als de gebruiker het niet zelf typt (vaak zo).
    .transform((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
    .pipe(z.string().url("Vul een geldige website in.")),
});

export async function startFreeCheck(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email"),
    websiteUrl: formData.get("websiteUrl"),
  };

  const parsed = FreeCheckInputSchema.safeParse(raw);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    redirect(`/gratis-check?error=${encodeURIComponent(msg)}`);
  }

  if (await isEmailRateLimited(parsed.data.email)) {
    redirect(
      `/gratis-check?error=${encodeURIComponent(
        "Je hebt vandaag het maximum (3) gratis checks bereikt. Probeer morgen opnieuw of word lid.",
      )}`,
    );
  }

  const [row] = await db
    .insert(leads)
    .values({
      email: parsed.data.email,
      websiteUrl: parsed.data.websiteUrl,
      status: "running",
    })
    .returning({ id: leads.id });

  // Achtergrond-analyse na het response (Next 15 `after`). Vangt zelf fouten
  // en schrijft 'failed' naar de lead — geen exception lekt uit.
  after(() =>
    runFreeCheck({
      leadId: row.id,
      websiteUrl: parsed.data.websiteUrl,
    }),
  );

  redirect(`/gratis-check/${row.id}`);
}
