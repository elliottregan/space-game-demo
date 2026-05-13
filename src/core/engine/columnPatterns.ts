// Pure poker-pattern evaluator over a single Column.

import type { Card, Column, KeystoneProject, PatternKind } from "../types.ts";
import { columnCards, isBuildable } from "./column.ts";
import { identifyRowHand, type RowHand } from "./rowHands.ts";

export interface PatternMatch {
  kind: PatternKind;
  projectId: string;
  cards: Card[];
}

export function evaluateColumn(col: Column, projects: KeystoneProject[]): PatternMatch | null {
  if (!isBuildable(col)) return null;

  const cards = columnCards(col);
  const landHand = identifyRowHand(col.lands.cards);
  const roleHand = identifyRowHand(col.influence.cards);
  const isColumnFlush = sharesOneIdeology(cards);

  const kind = resolveColumnPattern(landHand, roleHand, isColumnFlush);
  if (kind === null) return null;

  const project = projects.find((p) => p.pattern === kind);
  if (!project) return null;
  return { kind, projectId: project.id, cards };
}

function resolveColumnPattern(
  land: RowHand | null,
  role: RowHand | null,
  flush: boolean,
): PatternKind | null {
  if (land === null || role === null) return null;

  // 1. royal-flush — role-row straight + column-flush
  if (role === "straight" && flush) return "royal-flush";

  // 2. straight-flush — land-row straight + column-flush
  if (land === "straight" && flush) return "straight-flush";

  // 3. four-of-a-kind — any row has four
  if (land === "four-of-a-kind" || role === "four-of-a-kind") return "four-of-a-kind";

  // 4. full-house — row has full-house, OR one row has three + the other has at least a pair
  if (land === "full-house" || role === "full-house") return "full-house";
  if (land === "three-of-a-kind" && containsPair(role)) return "full-house";
  if (role === "three-of-a-kind" && containsPair(land)) return "full-house";

  // 5. flush — column-wide ideology
  if (flush) return "flush";

  // 6. straight — any row contains a straight
  if (land === "straight" || role === "straight") return "straight";

  // 7. three-of-a-kind — any row has three
  if (land === "three-of-a-kind" || role === "three-of-a-kind") return "three-of-a-kind";

  // 8. two-pair — row has two-pair, OR both rows have at least a pair
  if (land === "two-pair" || role === "two-pair") return "two-pair";
  if (containsPair(land) && containsPair(role)) return "two-pair";

  // 9. pair — any row has a pair
  if (land === "pair" || role === "pair") return "pair";

  // 10. high-card
  return "high-card";
}

function containsPair(h: RowHand | null): boolean {
  // "Has at least a pair structurally" — any row with 2+ same-rank cards.
  return (
    h === "pair" ||
    h === "two-pair" ||
    h === "three-of-a-kind" ||
    h === "four-of-a-kind" ||
    h === "full-house"
  );
}

function sharesOneIdeology(cards: Card[]): boolean {
  // "wild" cards never satisfy a flush.
  if (cards.some((c) => c.ideology === "wild")) return false;
  if (cards.length === 0) return false;
  const ideology = cards[0].ideology;
  return cards.every((c) => c.ideology === ideology);
}
