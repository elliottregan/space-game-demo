// Card + keystone label helpers.

import type { Card, CardIdeology } from "../../core/types.ts";

export function rankLabel(rank: number): string {
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 14) return "A";
  if (rank === 15) return "★";
  return String(rank);
}

export function suitLabel(ideology: CardIdeology): string {
  switch (ideology) {
    case "solidarity":
      return "Sol";
    case "sovereignty":
      return "Sov";
    case "transformation":
      return "Trn";
    case "heritage":
      return "Her";
    case "wild":
      return "Wild";
  }
}

export function landMaterialPerTurn(rank: number): number {
  if (rank <= 5) return 1;
  if (rank <= 7) return 2;
  return 3;
}

export function keystoneLabel(id: string): string {
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

export function isDissent(card: Card): boolean {
  return card.tags.includes("dissent");
}
