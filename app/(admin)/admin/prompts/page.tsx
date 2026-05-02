import Link from "next/link";
import { MODULES } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

export default function PromptsOverviewPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">Prompt Editor</h1>
      <p className="mt-1 text-sm text-gray-600">
        Beheer de default prompt per module.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {MODULES.map((module) => {
          const Icon = module.icon;
          const isActive = module.status === "active";
          return (
            <Link
              key={module.slug}
              href={`/admin/prompts/${module.slug}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
                !isActive && "opacity-60"
              )}
            >
              <div
                className={cn(
                  "rounded-lg bg-white p-2 ring-1 ring-gray-100",
                  module.iconColor
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{module.name}</div>
                <div className="text-xs text-gray-500">
                  {isActive ? "Actief" : "Binnenkort"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
