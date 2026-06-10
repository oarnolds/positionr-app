import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "@/modules/website-check/schema";
import { WEBSITE_CHECK_PREVIEW_FIXTURE } from "@/modules/website-check/preview-fixture";

/**
 * Haalt voorbeelddata op voor de admin-preview-tab van een module.
 *
 * Voor `website-check`: pakt de meest recente sessie met een geldige
 * output (status `review` of `approved` → impliciet via `output is not null`).
 * Bij geen sessie of corrupt output: fallback naar fixture.
 *
 * Andere modules: voorlopig altijd fixture (v1: alleen website-check
 * heeft een layout-editor).
 */
export async function getPreviewData(slug: string): Promise<WebsiteCheckOutput> {
  if (slug !== "website-check") {
    return WEBSITE_CHECK_PREVIEW_FIXTURE;
  }

  const rows = await db
    .select({ output: sessions.output })
    .from(sessions)
    .where(
      and(eq(sessions.moduleSlug, slug), isNotNull(sessions.output)),
    )
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  if (rows.length === 0) return WEBSITE_CHECK_PREVIEW_FIXTURE;

  const parsed = WebsiteCheckOutputSchema.safeParse(rows[0].output);
  return parsed.success ? parsed.data : WEBSITE_CHECK_PREVIEW_FIXTURE;
}
