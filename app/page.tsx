import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-6xl font-bold text-transparent">
            Positionr
          </h1>
          <p className="mt-6 text-xl text-gray-600">
            Snel inzicht in wat je marketing oplevert,
            <br />
            zodat je met vertrouwen kunt bijsturen.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link href="/modules">
              <Button size="lg">
                Bekijk modules <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Inloggen
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
