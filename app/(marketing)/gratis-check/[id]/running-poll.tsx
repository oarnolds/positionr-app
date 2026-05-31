"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polled server-side refresh: roept `router.refresh()` elke 3s aan zolang de
 * gebruiker op deze pagina staat. Geen volledige page-reload — de gebruiker
 * kan vrij weg navigeren zonder dat de analyse stopt (die loopt server-side).
 */
export function RunningPoll({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
