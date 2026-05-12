// Ideology vector derivation + alignment + demonym.
// Vector is derived from the column contents each call — never stored.

import type { Card, Ideology } from "../data/cards.ts";
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

export function deriveVector(columns: Column[], terrain: IdeologyTerrain): IdeologyVector {
  let axis1 = terrain.axis1;
  let axis2 = terrain.axis2;

  for (const col of columns) {
    for (const card of columnCards(col)) {
      if (card.ideology === "wild") continue;
      const r = card.rank;
      switch (card.ideology) {
        case "solidarity":
          axis1 -= r;
          break;
        case "sovereignty":
          axis1 += r;
          break;
        case "transformation":
          axis2 += r;
          break;
        case "heritage":
          axis2 -= r;
          break;
      }
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
  return candidates[0]!.verdict;
}

function axisVerdict(ideology: Ideology, axis: "axis1" | "axis2", value: number): Alignment {
  if (axis === "axis1") {
    if (ideology === "solidarity") return value < 0 ? "aligned" : value > 0 ? "opposed" : "neutral";
    if (ideology === "sovereignty")
      return value > 0 ? "aligned" : value < 0 ? "opposed" : "neutral";
    return "neutral";
  }
  if (ideology === "transformation")
    return value > 0 ? "aligned" : value < 0 ? "opposed" : "neutral";
  if (ideology === "heritage") return value < 0 ? "aligned" : value > 0 ? "opposed" : "neutral";
  return "neutral";
}

export function influenceCostAdjustment(alignment: Alignment): number {
  if (alignment === "aligned") return -1;
  if (alignment === "opposed") return 1;
  return 0;
}

export function demonym(vector: IdeologyVector): Demonym {
  const a1 = vector.axis1;
  const a2 = vector.axis2;

  const candidates: { d: Demonym; mag: number }[] = [];
  if (a1 <= -6) candidates.push({ d: "collective", mag: Math.abs(a1) });
  if (a1 >= 6) candidates.push({ d: "dominion", mag: Math.abs(a1) });
  if (a2 >= 6) candidates.push({ d: "ascendancy", mag: Math.abs(a2) });
  if (a2 <= -6) candidates.push({ d: "keepers", mag: Math.abs(a2) });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mag - a.mag);
  return candidates[0]!.d;
}

export function demonymName(d: Demonym): string {
  switch (d) {
    case "collective":
      return "The Collective";
    case "dominion":
      return "The Dominion";
    case "ascendancy":
      return "The Ascendancy";
    case "keepers":
      return "The Keepers";
    default:
      return "Unaligned";
  }
}
