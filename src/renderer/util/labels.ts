// Card display label helpers.

import type { Card, CardIdeology } from "../../core/types.ts";
import { IDEOLOGY_DISPLAY } from "../../core/data/ideologies.ts";

export function rankLabel(rank: number): string {
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 14) return "A";
  if (rank === 15) return "★";
  return String(rank);
}

export function suitLabel(ideology: CardIdeology): string {
  if (ideology === "wild") return "Wild";
  return IDEOLOGY_DISPLAY[ideology].abbrev;
}

export function landMaterialPerTurn(rank: number): number {
  if (rank <= 5) return 1;
  if (rank <= 7) return 2;
  return 3;
}

export function isDissent(card: Card): boolean {
  return card.tags.includes("dissent");
}
