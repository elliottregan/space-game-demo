// Ideology display config. The four canonical ideologies plus per-ideology
// display properties (name, abbrev, code, CSS var). "Wild" is special-cased
// at the call sites — it is intentionally not in this record.

export type Ideology = "solidarity" | "sovereignty" | "transformation" | "heritage";

export interface IdeologyDisplay {
  id: Ideology;
  /** Full name, title-cased. */
  name: string;
  /** 3-letter, all caps. Canonical short form. */
  abbrev: string;
  /** 1-char code (V for Sovereignty since S is taken by Solidarity). */
  code: string;
  /** CSS custom-property name (renderer reads via var(--…)). */
  cssColorVar: string;
}

export const IDEOLOGY_DISPLAY: Record<Ideology, IdeologyDisplay> = {
  solidarity: {
    id: "solidarity",
    name: "Solidarity",
    abbrev: "SOL",
    code: "S",
    cssColorVar: "--suit-solidarity",
  },
  sovereignty: {
    id: "sovereignty",
    name: "Sovereignty",
    abbrev: "SOV",
    code: "V",
    cssColorVar: "--suit-sovereignty",
  },
  transformation: {
    id: "transformation",
    name: "Transformation",
    abbrev: "TRA",
    code: "T",
    cssColorVar: "--suit-transformation",
  },
  heritage: {
    id: "heritage",
    name: "Heritage",
    abbrev: "HER",
    code: "H",
    cssColorVar: "--suit-heritage",
  },
};

export const IDEOLOGIES: Ideology[] = ["solidarity", "sovereignty", "transformation", "heritage"];

/** Empty-zeroed breakdown counter, useful for tallies. */
export function zeroIdeologyBreakdown(): Record<Ideology, number> {
  return { solidarity: 0, sovereignty: 0, transformation: 0, heritage: 0 };
}
