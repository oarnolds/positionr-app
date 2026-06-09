import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { MODULE_SLUG } from "@/modules/website-check";
import { getModuleLayout } from "@/lib/modules/layouts";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ shareSlug: string }>;
}) {
  const { shareSlug } = await params;
  const [row] = await db
    .select({ output: sessions.output, status: sessions.status, moduleSlug: sessions.moduleSlug })
    .from(sessions)
    .where(and(eq(sessions.shareSlug, shareSlug), eq(sessions.status, "approved")))
    .limit(1);

  if (!row || row.moduleSlug !== MODULE_SLUG) notFound();

  const parsed = WebsiteCheckOutputSchema.safeParse(row.output);
  if (!parsed.success) notFound();

  const layout = await getModuleLayout(MODULE_SLUG);
  return <WebsiteCheckResultView data={parsed.data} layout={layout} readOnly />;
}
