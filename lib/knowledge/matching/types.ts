/** Eén matchbare sectie uit een module-output (adapter-uitvoer). */
export type MatchableSection = { key: string; titel: string; tekst: string };

/** Goedgekeurde kaart zoals de engine 'm leest. */
export type ApprovedCard = {
  id: string;
  title: string;
  kern: string;
  toepassing: string;
  sourceLabel: string;
  themes: string[];
};

/** Gesnapshot blokje zoals opgeslagen op de sessie en gerenderd. */
export type KnowledgeBlock = {
  sectionKey: string;
  rank: number;
  bridge: string;
  cardId: string;
  card: { title: string; kern: string; toepassing: string; sourceLabel: string };
};
