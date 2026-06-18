import { ALL_CARDS } from "../src/core/data/cards.ts";
import { isWildCard } from "../src/core/engine/countsAs.ts";
import { HOMEWORLD } from "../src/core/settings/homeworld.ts";
import { GENERATION_SHIP } from "../src/core/settings/generationShip.ts";
import { RUINED_HOMEWORLD } from "../src/core/settings/ruinedHomeworld.ts";

function analyzePatterns(name: string, cardIds: string[]) {
  const cardMap = new Map(ALL_CARDS.map((c) => [c.id, c]));

  const ideologies = new Set<string>();
  const landsByRank = new Map<number, number>(); // rank -> count across ideologies
  const landsByIdeology = new Map<string, Set<number>>(); // ideology -> set of ranks
  const roles = new Set<string>();
  let jokers = 0; // full-joker wilds (ex-charters): complete any rank/color/row

  for (const id of cardIds) {
    const card = cardMap.get(id);
    if (!card) continue;

    // Jokers (countsAs wilds) are universal completers, not real same-rank or
    // flush contributors — count them separately and skip the literal tallies.
    if (isWildCard(card)) {
      jokers++;
      continue;
    }

    ideologies.add(card.ideology);

    if (card.kind === "land") {
      landsByRank.set(card.rank, (landsByRank.get(card.rank) ?? 0) + 1);
      if (!landsByIdeology.has(card.ideology)) {
        landsByIdeology.set(card.ideology, new Set());
      }
      landsByIdeology.get(card.ideology)!.add(card.rank);
    }

    if (card.kind === "role") {
      roles.add(card.role!);
    }
  }

  const reachable: string[] = [];
  const locked: string[] = [];

  // high-card: always reachable (need 1 land, we always have lands)
  reachable.push("high-card");

  // pair: need 2+ lands of same rank
  const hasPair = Array.from(landsByRank.values()).some((count) => count >= 2);
  if (hasPair) reachable.push("pair");
  else locked.push("pair");

  // two-pair: need 2 lands of rank A + 2 lands of rank B (same row)
  const pairableRanks = Array.from(landsByRank.entries())
    .filter(([_, count]) => count >= 2)
    .map(([rank]) => rank);
  if (pairableRanks.length >= 2) reachable.push("two-pair");
  else locked.push("two-pair");

  // three-of-a-kind: need 3+ lands of same rank
  const hasThree = Array.from(landsByRank.values()).some((count) => count >= 3);
  if (hasThree) reachable.push("three-of-a-kind");
  else locked.push("three-of-a-kind");

  // four-of-a-kind: need 4 lands of same rank
  const hasFour = Array.from(landsByRank.values()).some((count) => count >= 4);
  if (hasFour) reachable.push("four-of-a-kind");
  else locked.push("four-of-a-kind");

  // straight (lands): need 5 consecutive ranks (e.g., 4-5-6-7-8)
  const ranks = Array.from(landsByRank.keys()).sort((a, b) => a - b);
  let maxConsec = 1;
  for (let i = 0; i < ranks.length - 1; i++) {
    if (ranks[i + 1] === ranks[i] + 1) maxConsec++;
    else maxConsec = 1;
  }
  if (maxConsec >= 5) reachable.push("straight");
  else locked.push("straight");

  // straight (roles): need all 5 role types
  if (roles.size === 5) reachable.push("straight (roles)");
  else locked.push("straight (roles)");

  // full-house: 3 of one rank + 2 of another (same row)
  const threeableRanks = Array.from(landsByRank.entries())
    .filter(([_, count]) => count >= 3)
    .map(([rank]) => rank);
  const twoableRanks = Array.from(landsByRank.entries())
    .filter(([_, count]) => count >= 2)
    .map(([rank]) => rank);
  const hasFullHouse =
    threeableRanks.length >= 1 &&
    twoableRanks.filter((r) => !threeableRanks.includes(r)).length >= 1;
  if (hasFullHouse) reachable.push("full-house");
  else locked.push("full-house");

  // Real (non-joker) role cards of a given ideology present in the deck.
  const rolesOf = (ideology: string) =>
    Array.from(cardMap.values()).filter(
      (c) =>
        c.kind === "role" && !isWildCard(c) && c.ideology === ideology && cardIds.includes(c.id),
    );

  // flush: a single-color column over Land + Influence (charter is gone). Need
  // ≥1 land-row card AND ≥1 role-row card all admitting one color. Jokers admit
  // any color and either row, so they can supply a missing land or role.
  let flushable = false;
  for (const ideology of ideologies) {
    const hasLand = (landsByIdeology.get(ideology)?.size ?? 0) > 0;
    const hasRole = rolesOf(ideology).length > 0;
    let need = 0;
    if (!hasLand) need++;
    if (!hasRole) need++;
    if (jokers >= need) {
      flushable = true;
      break;
    }
  }
  // An all-joker column (≥2 jokers) trivially flushes (intersection = all colors).
  if (!flushable && jokers >= 2) flushable = true;
  if (flushable) reachable.push("flush");
  else locked.push("flush");

  // straight-flush: a land-row straight of one color + a role-row card of that
  // color. Jokers fill straight gaps and/or the role slot.
  let straightFlushable = false;
  for (const ideology of ideologies) {
    const landsOfIdeology = Array.from(landsByIdeology.get(ideology) ?? []).sort((a, b) => a - b);
    // Best run of consecutive distinct ranks; jokers fill the remaining gaps.
    let bestRun = landsOfIdeology.length === 0 ? 0 : 1;
    for (let lo = 2; lo <= 10; lo++) {
      const window = new Set([lo, lo + 1, lo + 2, lo + 3, lo + 4]);
      const inWindow = landsOfIdeology.filter((r) => window.has(r)).length;
      bestRun = Math.max(bestRun, inWindow);
    }
    const landGap = Math.max(0, 5 - bestRun); // jokers needed to complete the land straight
    const hasRole = rolesOf(ideology).length > 0;
    const roleGap = hasRole ? 0 : 1; // a joker can supply the role-row card
    if (jokers >= landGap + roleGap && bestRun >= 1) {
      straightFlushable = true;
      break;
    }
  }
  if (straightFlushable) reachable.push("straight-flush");
  else locked.push("straight-flush");

  // royal-flush: all 5 role types of one color in the role row + ≥1 land of that
  // color, all one color. Jokers fill missing role types and/or the land slot.
  let royalFlushable = false;
  for (const ideology of ideologies) {
    const roleTypesOfIdeology = new Set(rolesOf(ideology).map((c) => c.role));
    const roleGap = Math.max(0, 5 - roleTypesOfIdeology.size); // jokers to complete the 5 role types
    const hasLand = (landsByIdeology.get(ideology)?.size ?? 0) > 0;
    const landGap = hasLand ? 0 : 1; // a joker can supply the land-row card
    if (jokers >= roleGap + landGap) {
      royalFlushable = true;
      break;
    }
  }
  if (royalFlushable) reachable.push("royal-flush");
  else locked.push("royal-flush");

  return { reachable, locked };
}

const hw = analyzePatterns("Homeworld", HOMEWORLD.startingDeck);
const gs = analyzePatterns("Generation Ship", GENERATION_SHIP.startingDeck);
const rh = analyzePatterns("Ruined Homeworld", RUINED_HOMEWORLD.startingDeck);

console.log("HOMEWORLD");
console.log("  Reachable:", hw.reachable.join(", "));
console.log("  Locked:", hw.locked.join(", "));
console.log();

console.log("GENERATION SHIP");
console.log("  Reachable:", gs.reachable.join(", "));
console.log("  Locked:", gs.locked.join(", "));
console.log();

console.log("RUINED HOMEWORLD");
console.log("  Reachable:", rh.reachable.join(", "));
console.log("  Locked:", rh.locked.join(", "));
