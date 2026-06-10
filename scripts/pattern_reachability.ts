import { ALL_CARDS } from "../src/core/data/cards.ts";
import { HOMEWORLD } from "../src/core/settings/homeworld.ts";
import { GENERATION_SHIP } from "../src/core/settings/generationShip.ts";
import { RUINED_HOMEWORLD } from "../src/core/settings/ruinedHomeworld.ts";

function analyzePatterns(name: string, cardIds: string[]) {
  const cardMap = new Map(ALL_CARDS.map((c) => [c.id, c]));

  const ideologies = new Set<string>();
  const landsByRank = new Map<number, number>(); // rank -> count across ideologies
  const landsByIdeology = new Map<string, Set<number>>(); // ideology -> set of ranks
  const roles = new Set<string>();

  for (const id of cardIds) {
    const card = cardMap.get(id);
    if (!card) continue;

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

  // flush: all cards (lands + roles + charters) share one ideology
  if (ideologies.size === 1) reachable.push("flush");
  else {
    // Can we make a flush with one ideology?
    let flushable = false;
    for (const ideology of ideologies) {
      if (ideology === "wild") continue; // wild doesn't make a flush
      const landsOfIdeology = landsByIdeology.get(ideology)?.size ?? 0;
      const rolesOfIdeology = Array.from(cardMap.values()).filter(
        (c) => c.kind === "role" && c.ideology === ideology && cardIds.includes(c.id),
      ).length;
      const chartersOfIdeology = Array.from(cardMap.values()).filter(
        (c) => c.kind === "charter" && c.ideology === ideology && cardIds.includes(c.id),
      ).length;
      // Need at least 1 of each kind for a column
      if (landsOfIdeology > 0 && rolesOfIdeology > 0) {
        flushable = true;
        break;
      }
    }
    if (flushable) reachable.push("flush");
    else locked.push("flush");
  }

  // straight-flush: land straight of one ideology + role + charter of same ideology
  let straightFlushable = false;
  for (const ideology of ideologies) {
    if (ideology === "wild") continue;
    const landsOfIdeology = Array.from(landsByIdeology.get(ideology) ?? []).sort((a, b) => a - b);
    let maxConsecOfIdeology = 1;
    for (let i = 0; i < landsOfIdeology.length - 1; i++) {
      if (landsOfIdeology[i + 1] === landsOfIdeology[i] + 1) maxConsecOfIdeology++;
      else maxConsecOfIdeology = 1;
    }
    if (maxConsecOfIdeology >= 5) {
      const rolesOfIdeology = Array.from(cardMap.values()).filter(
        (c) => c.kind === "role" && c.ideology === ideology && cardIds.includes(c.id),
      ).length;
      if (rolesOfIdeology > 0) {
        straightFlushable = true;
        break;
      }
    }
  }
  if (straightFlushable) reachable.push("straight-flush");
  else locked.push("straight-flush");

  // royal-flush: all 5 role types of one ideology + land straight of same ideology + charter of same ideology
  let royalFlushable = false;
  for (const ideology of ideologies) {
    if (ideology === "wild") continue;
    const rolesOfIdeology = Array.from(cardMap.values()).filter(
      (c) => c.kind === "role" && c.ideology === ideology && cardIds.includes(c.id),
    );
    const roleTypesOfIdeology = new Set(rolesOfIdeology.map((c) => c.role));
    if (roleTypesOfIdeology.size === 5) {
      const landsOfIdeology = Array.from(landsByIdeology.get(ideology) ?? []).sort((a, b) => a - b);
      let maxConsecOfIdeology = 1;
      for (let i = 0; i < landsOfIdeology.length - 1; i++) {
        if (landsOfIdeology[i + 1] === landsOfIdeology[i] + 1) maxConsecOfIdeology++;
        else maxConsecOfIdeology = 1;
      }
      if (maxConsecOfIdeology >= 5) {
        const chartersOfIdeology = Array.from(cardMap.values()).filter(
          (c) => c.kind === "charter" && c.ideology === ideology && cardIds.includes(c.id),
        ).length;
        if (chartersOfIdeology > 0) {
          royalFlushable = true;
          break;
        }
      }
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
