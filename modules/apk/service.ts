import { db } from "@/lib/db/client";
import { apkRuns } from "@/lib/db/schema";
import { getOrCreateSnapshot } from "@/lib/scraping/snapshot-service";
import { normalizeBaseUrl } from "@/lib/scraping/url-to-markdown";
import { APK_MODULE_RUNNERS, getApkRunner } from "./runners";

export type StartApkRunInput = {
  userId: string;
  sourceUrl: string;
  /** Slugs van de modules die de gebruiker geselecteerd heeft. */
  selectedModules: string[];
};

export type StartApkRunResult = {
  runId: string;
  snapshotId: string;
  snapshotWasCached: boolean;
  startedSessions: Array<{
    moduleSlug: string;
    sessionId: string;
    run: () => Promise<void>;
  }>;
};

/**
 * Start een APK-run:
 *   1. Maakt/refresht synchroon de gedeelde markdown-snapshot voor de URL.
 *   2. Maakt een apk_runs row.
 *   3. Maakt voor elke geselecteerde + bekende module een sessie aan.
 *
 * De caller moet de teruggegeven `run` callbacks zelf schedulen (bv. via
 * Next's `after()`) zodat de response niet hoeft te wachten op de LLM-calls.
 */
export async function startApkRun(
  input: StartApkRunInput
): Promise<StartApkRunResult> {
  const sourceUrl = normalizeBaseUrl(input.sourceUrl);
  const validModuleSlugs = input.selectedModules.filter((slug) =>
    APK_MODULE_RUNNERS.some((r) => r.slug === slug)
  );

  if (validModuleSlugs.length === 0) {
    throw new Error("Geen geldige modules geselecteerd voor deze APK-run.");
  }

  // 1) Snapshot synchroon (gebruiker verwacht 'voorbewerking' bij start).
  const { snapshot, fresh } = await getOrCreateSnapshot({
    userId: input.userId,
    kind: "website",
    sourceUrl,
  });

  // 2) APK-run row.
  const [runRow] = await db
    .insert(apkRuns)
    .values({
      userId: input.userId,
      sourceUrl,
      snapshotId: snapshot.id,
      snapshotWasCached: !fresh,
      selectedModules: validModuleSlugs,
    })
    .returning({ id: apkRuns.id });

  // 3) Per geselecteerde module: maak sessie aan (synchroon) en
  //    verzamel de async run-callbacks voor de caller.
  const startedSessions: StartApkRunResult["startedSessions"] = [];
  for (const slug of validModuleSlugs) {
    const runner = getApkRunner(slug);
    if (!runner) continue;
    const started = await runner.start({
      userId: input.userId,
      sourceUrl,
      apkRunId: runRow.id,
    });
    startedSessions.push({
      moduleSlug: slug,
      sessionId: started.sessionId,
      run: started.run,
    });
  }

  return {
    runId: runRow.id,
    snapshotId: snapshot.id,
    snapshotWasCached: !fresh,
    startedSessions,
  };
}
