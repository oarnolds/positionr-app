import Link from "next/link";
import { MODULES } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

export default function ModulesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-5xl font-bold text-transparent">
          Core Modules
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Kies een module om een AI-gedreven analyse te starten.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.filter((m) => !m.parentSlug).map((module) => {
          const Icon = module.icon;
          const isActive = module.status === "active";

          const card = (
            <div
              className={cn(
                "group flex h-full flex-col rounded-2xl border-2 p-5 transition-all duration-200",
                module.borderColor,
                module.bgLight,
                isActive
                  ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg"
                  : "opacity-60"
              )}
            >
              <div className="flex flex-1 items-start gap-3">
                <div
                  className={cn(
                    "shrink-0 rounded-xl bg-white p-2.5 shadow-sm",
                    module.iconColor
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="mb-1 text-base font-bold leading-tight text-gray-900">
                    {module.name}
                  </h2>
                  <p className="text-xs leading-relaxed text-gray-600">
                    {module.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                {isActive ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg bg-gradient-to-r px-3 py-1.5 text-xs font-semibold text-white shadow-sm",
                      module.color
                    )}
                  >
                    Start →
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                    Binnenkort
                  </span>
                )}
              </div>
            </div>
          );

          return isActive && module.href ? (
            <Link key={module.slug} href={module.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={module.slug}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
