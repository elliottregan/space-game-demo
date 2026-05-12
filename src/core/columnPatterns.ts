// Pure poker-pattern evaluator over a single Column.

import type { Card, Column, KeystoneProject, PatternKind } from "./types.ts";
import { columnCards, isBuildable } from "./column.ts";

export interface PatternMatch {
  kind: PatternKind;
  projectId: string;
  cards: Card[];
}

export function evaluateColumn(
  col: Column,
  projects: KeystoneProject[],
): PatternMatch | null {
  if (!isBuildable(col)) return null;

  const cards = columnCards(col);
  const landCount = col.lands.cards.length;
  const isFlush = sharesOneIdeology(cards);

  // Highest poker rank first.
  let kind: PatternKind;
  if (landCount === 4) {
    kind = "four-of-a-kind";
  } else if (isFlush) {
    kind = "flush";
  } else if (landCount === 3) {
    kind = "three-of-a-kind";
  } else if (landCount === 2) {
    kind = "pair";
  } else {
    kind = "high-card";
  }

  const project = projects.find((p) => p.pattern === kind);
  if (!project) return null;
  return { kind, projectId: project.id, cards };
}

function sharesOneIdeology(cards: Card[]): boolean {
  // "wild" cards never satisfy a flush.
  if (cards.some((c) => c.ideology === "wild")) return false;
  if (cards.length === 0) return false;
  const ideology = cards[0]!.ideology;
  return cards.every((c) => c.ideology === ideology);
}
