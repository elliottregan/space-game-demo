// Ideology vector derivation + demonym.
// Vector is derived from the column contents each call — never stored.

import type { KeystoneProject, ProjectUnlock } from "../data/projects.ts";
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

// -------------------------------------------------------------------------
// Vector derivation
// -------------------------------------------------------------------------

export function deriveVector(
  columns: Column[],
  unlockedProjects: ProjectUnlock[],
  projects: KeystoneProject[],
): IdeologyVector {
  const v = { axis1: 0, axis2: 0 };
  for (const col of columns) {
    for (const c of columnCards(col)) {
      if (c.ideology === "wild") continue;
      const { axis, sign } = IDEOLOGY_AXIS[c.ideology];
      v[axis] += sign;
    }
  }
  for (const u of unlockedProjects) {
    const value = projects.find((p) => p.id === u.projectId)?.value ?? 0;
    const net = { axis1: 0, axis2: 0 };
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      const { axis, sign } = IDEOLOGY_AXIS[c.ideology];
      net[axis] += sign;
    }
    v.axis1 += Math.sign(net.axis1) * value;
    v.axis2 += Math.sign(net.axis2) * value;
  }
  return v;
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
