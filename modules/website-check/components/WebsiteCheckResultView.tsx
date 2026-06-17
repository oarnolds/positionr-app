import { WebsiteCheckReport } from "../report/WebsiteCheckReport";

/**
 * Entry-point voor het Website Check resultaat. Houdt de container-styling
 * (centered, padding) en delegeert naar de rapport-renderer.
 */
export function WebsiteCheckResultView({
  markdown,
}: {
  markdown: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <WebsiteCheckReport markdown={markdown} />
    </div>
  );
}
