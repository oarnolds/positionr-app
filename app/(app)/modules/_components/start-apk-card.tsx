import { Sparkles } from "lucide-react";
import { APK_MODULE_RUNNERS } from "@/modules/apk/runners";
import { startApkRunAction } from "@/app/(app)/modules/apk/actions";

export type StartApkCardProps = {
  defaultWebsiteUrl?: string;
};

export function StartApkCard({ defaultWebsiteUrl }: StartApkCardProps) {
  return (
    <section
      aria-labelledby="apk-heading"
      className="mb-10 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-white p-2.5 text-purple-600 shadow-sm">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2
            id="apk-heading"
            className="text-xl font-bold text-gray-900"
          >
            Je start APK
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Geef je website-URL op, kies welke analyses je wil starten en wij doen de
            voorbewerking (markdown-snapshot) één keer voor alle modules. Vers gemaakt
            of uit cache van de laatste 24 uur — beide werken automatisch.
          </p>
        </div>
      </div>

      <form
        action={startApkRunAction}
        className="mt-5 space-y-4"
      >
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Website-URL</span>
          <input
            name="websiteUrl"
            type="text"
            defaultValue={defaultWebsiteUrl ?? ""}
            placeholder="bijv. https://uwbedrijf.nl"
            className="mt-1 w-full rounded-lg border border-purple-200 bg-white px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            required
          />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-700">
            Welke modules wil je laten draaien?
          </legend>
          <div className="mt-2 space-y-2">
            {APK_MODULE_RUNNERS.map((runner) => (
              <label
                key={runner.slug}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-purple-100 bg-white p-3 hover:border-purple-300"
              >
                <input
                  type="checkbox"
                  name="modules"
                  value={runner.slug}
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">
                    {runner.name}
                  </span>
                  <span className="block text-xs text-gray-600">
                    {runner.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          <Sparkles className="h-4 w-4" />
          Start APK
        </button>
      </form>
    </section>
  );
}
