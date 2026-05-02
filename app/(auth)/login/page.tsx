import { sendMagicLink } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <div className="w-full">
          <div className="text-center">
            <Link
              href="/"
              className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-3xl font-bold text-transparent"
            >
              Positionr
            </Link>
            <h1 className="mt-6 text-2xl font-semibold">Inloggen</h1>
            <p className="mt-2 text-sm text-gray-600">
              Vul je e-mail in en je krijgt een magic link.
            </p>
          </div>

          {sent ? (
            <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
              Check je inbox — we hebben je een inloglink gestuurd.
            </div>
          ) : (
            <form action={sendMagicLink} className="mt-8 space-y-4">
              {params.next && <input type="hidden" name="next" value={params.next} />}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  E-mailadres
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="naam@bedrijf.nl"
                  className="mt-1"
                />
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full">
                Stuur magic link
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
