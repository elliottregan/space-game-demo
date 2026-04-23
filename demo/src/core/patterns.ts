// Hand-based mega-structure evaluation (redesign).
// A mega-structure completes when the player's hand contains:
//   - a poker-like hand matching the project's `requiredHand`
//   - AND the project's keystone card

import type {
  Card,
  CompletionTier,
  HandRequirement,
  Ideology,
  MegaProject,
  Role,
} from "./types.ts";

/** Report whether a project can be played from the given hand, and which cards to consume. */
export interface MegaStructureEval {
  canPlay: boolean;
  progress: string;
  consumableCards: Card[]; // the specific cards in hand that would be consumed on play (empty if !canPlay)
}

export function evaluateMegaStructure(project: MegaProject, hand: Card[]): MegaStructureEval {
  // Set aside the keystone first — it is required separately from the
  // poker-hand pattern and must not double-count.
  const keystoneIdx = hand.findIndex((c) => c.id === project.keystoneId);
  const rest = keystoneIdx === -1 ? hand : hand.filter((_, i) => i !== keystoneIdx);

  const handMatch = findRequiredHand(project.requiredHand, rest);

  if (keystoneIdx === -1 && !handMatch) {
    return { canPlay: false, progress: describeProgress(project, rest), consumableCards: [] };
  }
  if (keystoneIdx === -1) {
    return {
      canPlay: false,
      progress: `need ${keystoneLabel(project.keystoneId)}`,
      consumableCards: [],
    };
  }
  if (!handMatch) {
    return {
      canPlay: false,
      progress: describeProgress(project, rest),
      consumableCards: [],
    };
  }
  const keystone = hand[keystoneIdx]!;
  return {
    canPlay: true,
    progress: "ready",
    consumableCards: [...handMatch.cards, keystone],
  };
}

interface HandMatch {
  cards: Card[];
}

function findRequiredHand(req: HandRequirement, hand: Card[]): HandMatch | null {
  switch (req.kind) {
    case "four-of-a-kind": {
      const matches = hand.filter((c) => c.role === req.role);
      if (matches.length < req.count) return null;
      return { cards: matches.slice(0, req.count) };
    }
    case "flush": {
      const matches = hand.filter((c) => c.ideology === req.ideology);
      if (matches.length < req.count) return null;
      return { cards: matches.slice(0, req.count) };
    }
    case "straight": {
      const picked: Card[] = [];
      const used = new Set<number>();
      for (const rank of req.ranks) {
        const idx = hand.findIndex((c, i) => c.rank === rank && !used.has(i));
        if (idx === -1) return null;
        used.add(idx);
        picked.push(hand[idx]!);
      }
      return { cards: picked };
    }
  }
}

function describeProgress(project: MegaProject, hand: Card[]): string {
  const req = project.requiredHand;
  switch (req.kind) {
    case "four-of-a-kind": {
      const have = hand.filter((c) => c.role === req.role).length;
      return `${Math.min(have, req.count)}/${req.count} ${req.role}`;
    }
    case "flush": {
      const have = hand.filter((c) => c.ideology === req.ideology).length;
      return `${Math.min(have, req.count)}/${req.count} ${req.ideology} in hand`;
    }
    case "straight": {
      const have = req.ranks.filter((r) => hand.some((c) => c.rank === r)).length;
      return `${have}/${req.ranks.length} ranks ${req.ranks.join("-")}`;
    }
  }
}

function keystoneLabel(id: string): string {
  switch (id) {
    case "keystone-navigators-compass":
      return "Navigator's Compass";
    case "keystone-founding-charter":
      return "Founding Charter";
    case "keystone-critical-mass":
      return "Critical Mass";
    default:
      return "keystone";
  }
}

// -------------------------------------------------------------------------
// Scoring
// -------------------------------------------------------------------------

export function scoreMegaStructure(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.rank, 0);
}

export function completionTier(score: number): CompletionTier {
  if (score > 100) return "platinum";
  if (score >= 71) return "gold";
  if (score >= 41) return "silver";
  return "bronze";
}

export function legacyCandidateCount(tier: CompletionTier): number {
  switch (tier) {
    case "bronze":
      return 1;
    case "silver":
      return 2;
    case "gold":
      return 3;
    case "platinum":
      return 3;
  }
}

// -------------------------------------------------------------------------
// UI helper: describe requirement as a string
// -------------------------------------------------------------------------

export function describeRequirement(project: MegaProject): string {
  const req = project.requiredHand;
  switch (req.kind) {
    case "four-of-a-kind":
      return `4-of-a-Kind: ${req.count} ${req.role}s`;
    case "flush":
      return `Flush: ${req.count} ${req.ideology}`;
    case "straight":
      return `Straight: ranks ${req.ranks.join("-")}`;
  }
}

export { type Role, type Ideology };
