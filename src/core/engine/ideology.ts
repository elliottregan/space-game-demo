// Ideology vector derivation + alignment + demonym.
// Vector is derived from the column contents each call — never stored.

import type { Card } from "../data/cards.ts";
import { IDEOLOGIES, type Ideology } from "../data/ideologies.ts";
import { type Column, columnCards } from "./column.ts";

// -------------------------------------------------------------------------
// Ideology vector + terrain
// -------------------------------------------------------------------------

export interface IdeologyVector {
  /** +Sovereignty / -Solidarity */
  axis1: number;
  /** +Transformation / -Heritage */
  axis2: number;
}

export interface IdeologyTerrain {
  axis1: number;
  axis2: number;
}

export type Demonym = "collective" | "dominion" | "ascendancy" | "keepers" | null;

// -------------------------------------------------------------------------
// Mechanical config — links each ideology to its axis/sign and to its
// demonym. Lookup tables replace the inline switches that used to live in
// deriveVector / demonym.
// -------------------------------------------------------------------------

export const IDEOLOGY_AXIS: Record<Ideology, { axis: "axis1" | "axis2"; sign: -1 | 1 }> = {
  solidarity: { axis: "axis1", sign: -1 },
  sovereignty: { axis: "axis1", sign: 1 },
  transformation: { axis: "axis2", sign: 1 },
  heritage: { axis: "axis2", sign: -1 },
};

export const DEMONYM_BY_IDEOLOGY: Record<Ideology, NonNullable<Demonym>> = {
  solidarity: "collective",
  sovereignty: "dominion",
  transformation: "ascendancy",
  heritage: "keepers",
};

export const IDEOLOGY_BY_DEMONYM: Record<NonNullable<Demonym>, Ideology> = {
  collective: "solidarity",
  dominion: "sovereignty",
  ascendancy: "transformation",
  keepers: "heritage",
};

// The opposing ideology shares the same axis with the opposite sign — derived
// once from IDEOLOGY_AXIS so adding a fifth ideology stays a one-table edit.
export const OPPOSING_IDEOLOGY: Record<Ideology, Ideology> = Object.fromEntries(
  IDEOLOGIES.map((id) => {
    const { axis, sign } = IDEOLOGY_AXIS[id];
    const opposite = IDEOLOGIES.find(
      (other) => IDEOLOGY_AXIS[other].axis === axis && IDEOLOGY_AXIS[other].sign === -sign,
    );
    if (!opposite) throw new Error(`No opposing ideology for ${id}`);
    return [id, opposite];
  }),
) as Record<Ideology, Ideology>;

// -------------------------------------------------------------------------
// Vector derivation
// -------------------------------------------------------------------------

export function deriveVector(columns: Column[], terrain: IdeologyTerrain): IdeologyVector {
  let axis1 = terrain.axis1;
  let axis2 = terrain.axis2;
  for (const col of columns) {
    for (const card of columnCards(col)) {
      if (card.ideology === "wild") continue;
      const { axis, sign } = IDEOLOGY_AXIS[card.ideology];
      const delta = sign * card.rank;
      if (axis === "axis1") axis1 += delta;
      else axis2 += delta;
    }
  }
  return { axis1, axis2 };
}

export type Alignment = "aligned" | "opposed" | "neutral";

export function checkAlignment(card: Card, vector: IdeologyVector): Alignment {
  if (card.ideology === "wild") return "neutral";

  const a1Active = Math.abs(vector.axis1) >= 3;
  const a2Active = Math.abs(vector.axis2) >= 3;

  const a1Verdict = axisVerdict(card.ideology, "axis1", vector.axis1);
  const a2Verdict = axisVerdict(card.ideology, "axis2", vector.axis2);

  if (!a1Active && !a2Active) return "neutral";

  const candidates: { verdict: Alignment; magnitude: number }[] = [];
  if (a1Active && a1Verdict !== "neutral") {
    candidates.push({ verdict: a1Verdict, magnitude: Math.abs(vector.axis1) });
  }
  if (a2Active && a2Verdict !== "neutral") {
    candidates.push({ verdict: a2Verdict, magnitude: Math.abs(vector.axis2) });
  }

  if (candidates.length === 0) return "neutral";
  candidates.sort((a, b) => b.magnitude - a.magnitude);
  return candidates[0].verdict;
}

function axisVerdict(ideology: Ideology, axis: "axis1" | "axis2", value: number): Alignment {
  const map = IDEOLOGY_AXIS[ideology];
  if (map.axis !== axis) return "neutral";
  const projection = map.sign * value;
  if (projection > 0) return "aligned";
  if (projection < 0) return "opposed";
  return "neutral";
}

export function influenceCostAdjustment(alignment: Alignment): number {
  if (alignment === "aligned") return -1;
  if (alignment === "opposed") return 1;
  return 0;
}

export function demonym(vector: IdeologyVector): Demonym {
  const candidates: { d: NonNullable<Demonym>; mag: number }[] = [];
  for (const id of IDEOLOGIES) {
    const { axis, sign } = IDEOLOGY_AXIS[id];
    const projection = sign * vector[axis];
    if (projection >= 6) {
      candidates.push({ d: DEMONYM_BY_IDEOLOGY[id], mag: projection });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mag - a.mag);
  return candidates[0].d;
}

const DEMONYM_NAMES: Record<NonNullable<Demonym>, string> = {
  collective: "The Collective",
  dominion: "The Dominion",
  ascendancy: "The Ascendancy",
  keepers: "The Keepers",
};

export function demonymName(d: Demonym): string {
  return d ? DEMONYM_NAMES[d] : "Unaligned";
}
