export type ScoreBand = "rood" | "amber" | "groen";

/** Kleurband per score: rood <5, amber 5–<6,5, groen ≥6,5. */
export function scoreBand(score: number): ScoreBand {
  if (score < 5) return "rood";
  if (score < 6.5) return "amber";
  return "groen";
}
