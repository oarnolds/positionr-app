import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";

export default function WebsiteCheckPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Website Check</h1>
          <p className="text-gray-600">
            Analyseer uw B2B-website op waardepropositie, CTA&apos;s, content en
            verbeterpunten.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50 p-12 text-center">
        <p className="text-sm text-gray-600">
          Module-flow komt in <strong>week 2</strong>.<br />
          Foundation (auth + modules) staat eerst.
        </p>
      </div>
    </div>
  );
}
