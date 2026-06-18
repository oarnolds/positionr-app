import {
  createWebsiteCheckSession,
  runAnalysis as runWebsiteCheckAnalysis,
} from "@/modules/website-check/service";

/**
 * Een ApkModuleRunner beschrijft hoe een module gestart wordt vanuit een
 * "Je start APK"-flow. start() maakt synchroon de sessie aan en geeft een
 * `run` callback terug die de eigenlijke (potentieel lang lopende) analyse
 * uitvoert — de caller wraps die in `after()` zodat de response niet wacht.
 */
export type ApkModuleRunner = {
  slug: string;
  name: string;
  description: string;
  start: (args: {
    userId: string;
    sourceUrl: string;
    apkRunId: string;
  }) => Promise<{ sessionId: string; run: () => Promise<void> }>;
};

export const APK_MODULE_RUNNERS: ApkModuleRunner[] = [
  {
    slug: "website-check",
    name: "Website-check",
    description:
      "Volledige analyse van je website op waardepropositie, CTA's en content.",
    start: async ({ userId, sourceUrl, apkRunId }) => {
      const { sessionId } = await createWebsiteCheckSession({
        userId,
        websiteUrl: sourceUrl,
        companyName: "",
        apkRunId,
      });
      return {
        sessionId,
        run: () =>
          runWebsiteCheckAnalysis({
            sessionId,
            userId,
            websiteUrl: sourceUrl,
            companyName: "",
          }),
      };
    },
  },
];

export function getApkRunner(slug: string): ApkModuleRunner | undefined {
  return APK_MODULE_RUNNERS.find((r) => r.slug === slug);
}
