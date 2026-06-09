// modules/website-check/components/WebsiteCheckResultView.tsx
import type { WebsiteCheckOutput } from "../schema";
import type { LayoutConfig } from "@/lib/modules/layout";
import { SECTIONS } from "../sections";
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

/**
 * Config-driven result-view voor Website Check.
 *
 * - Itereert door `layout.items` in volgorde.
 * - Section → opzoekt Component in SECTIONS-registry; gebruikt admin-title
 *   (of fallback op `defaultTitle`) + admin-intro; sectie wordt geskipt
 *   als `visible=false`.
 * - Block  → vrije Markdown via MarkdownBlock.
 * - Onbekende section-id (na admin-rename of registry-cleanup) wordt
 *   silently geskipt.
 *
 * De caller (page.tsx) is verantwoordelijk voor het ophalen van de layout
 * via `getModuleLayout("website-check")`.
 */
export function WebsiteCheckResultView({
  data,
  layout,
}: {
  data: WebsiteCheckOutput;
  layout: LayoutConfig;
  readOnly?: boolean;
}) {
  const sectionById = new Map(SECTIONS.map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      {layout.items.map((item, idx) => {
        if (item.kind === "block") {
          return <MarkdownBlock key={`block-${item.id}`} markdown={item.markdown} />;
        }

        // section
        if (!item.visible) return null;
        const def = sectionById.get(item.id);
        if (!def) return null; // onbekende id, skip

        const title = item.title ?? def.defaultTitle;
        const Component = def.Component;
        return (
          <Component
            key={`section-${item.id}-${idx}`}
            data={data}
            title={title}
            intro={item.intro}
          />
        );
      })}
    </div>
  );
}
