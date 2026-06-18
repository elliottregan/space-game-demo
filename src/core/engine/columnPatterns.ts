// Pure poker-pattern evaluator over a single Column.

import type { Card, Column, KeystoneProject, PatternKind } from "../types.ts";
import type { Ideology } from "../data/cards.ts";
import { columnCards, isBuildable } from "./column.ts";
import { identifyRowHand, type RowHand } from "./rowHands.ts";
import { effectiveCard } from "./countsAs.ts";

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

// Independence invariant (full joker only): each wild's RANK and IDEOLOGY are
// assigned independently — the row classifier picks the rank to maximize the
// row-hand, sharesOneIdeology picks the color to complete a flush. Sound here
// because rank ⊥ color for an unconstrained full joker (it can be "the 9" for a
// straight AND "solidarity" for a flush at once), which is exactly why
// straight-flush / royal-flush work. A FUTURE partial wild that constrains a
// single wild on rank AND participates in a flush would need a joint solver.
function resolveColumnPattern(
  land: RowHand | null,
  role: RowHand | null,
  flush: boolean,
): PatternKind | null {
  // isBuildable already guarantees rows are non-empty, but identifyRowHand
  // still returns null when a row's contents don't form any known hand
  // (e.g. two different-rank lands). Bail out in that case — there's no
  // pattern to unlock.
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
  if (cards.length === 0) return false;
  // A flush exists iff the intersection over every card's admissible-color set
  // is non-empty. A full joker contributes all 4 colors (never narrows); a
  // partial ideology wild contributes its OR-set; a colorless non-wild
  // (bare-"wild" / Dissent) contributes the empty set, which BLOCKS. There is
  // NO isWild escape hatch — partial ideology wilds are honored set-theoretically.
  let inter: Set<Ideology> | null = null;
  for (const c of cards) {
    const colors = effectiveCard(c).ideologies;
    if (colors.length === 0) return false; // colorless, non-completing ⇒ no flush
    if (inter === null) inter = new Set(colors);
    else inter = new Set([...inter].filter((i: Ideology) => colors.includes(i)));
    if (inter.size === 0) return false;
  }
  return (inter?.size ?? 0) > 0;
}
