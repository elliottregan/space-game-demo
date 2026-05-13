import { ALL_CARDS } from "../src/core/data/cards.ts";
import { HOMEWORLD } from "../src/core/settings/homeworld.ts";
import { GENERATION_SHIP } from "../src/core/settings/generationShip.ts";
import { RUINED_HOMEWORLD } from "../src/core/settings/ruinedHomeworld.ts";

interface DeckAnalysis {
  ideologies: Set<string>;
  landRanks: Set<number>;
  roleTypes: Set<string>;
  ideologyLandRankCombos: Map<string, Set<number>>;
}

function analyzeDeck(cardIds: string[]): DeckAnalysis {
  const cardMap = new Map(ALL_CARDS.map((c) => [c.id, c]));
  const analysis: DeckAnalysis = {
    ideologies: new Set(),
    landRanks: new Set(),
    roleTypes: new Set(),
    ideologyLandRankCombos: new Map(),
  };

  for (const id of cardIds) {
    const card = cardMap.get(id);
    if (!card) continue;

    analysis.ideologies.add(card.ideology);

    if (card.kind === "land") {
      analysis.landRanks.add(card.rank);
      if (!analysis.ideologyLandRankCombos.has(card.ideology)) {
        analysis.ideologyLandRankCombos.set(card.ideology, new Set());
      }
      analysis.ideologyLandRankCombos.get(card.ideology)!.add(card.rank);
    }

    if (card.kind === "role") {
      analysis.roleTypes.add(card.role!);
    }
  }

  return analysis;
}

const hw = analyzeDeck(HOMEWORLD.startingDeck);
const gs = analyzeDeck(GENERATION_SHIP.startingDeck);
const rh = analyzeDeck(RUINED_HOMEWORLD.startingDeck);

console.log("=== HOMEWORLD ===");
console.log("Ideologies:", Array.from(hw.ideologies).sort());
console.log(
  "Land ranks:",
  Array.from(hw.landRanks).sort((a, b) => a - b),
);
console.log("Role types:", Array.from(hw.roleTypes).sort());
console.log(
  "Ideology-land combos:",
  Object.fromEntries(
    Array.from(hw.ideologyLandRankCombos).map(([i, ranks]) => [
      i,
      Array.from(ranks).sort((a, b) => a - b),
    ]),
  ),
);
console.log();

console.log("=== GENERATION SHIP ===");
console.log("Ideologies:", Array.from(gs.ideologies).sort());
console.log(
  "Land ranks:",
  Array.from(gs.landRanks).sort((a, b) => a - b),
);
console.log("Role types:", Array.from(gs.roleTypes).sort());
console.log(
  "Ideology-land combos:",
  Object.fromEntries(
    Array.from(gs.ideologyLandRankCombos).map(([i, ranks]) => [
      i,
      Array.from(ranks).sort((a, b) => a - b),
    ]),
  ),
);
console.log();

console.log("=== RUINED HOMEWORLD ===");
console.log("Ideologies:", Array.from(rh.ideologies).sort());
console.log(
  "Land ranks:",
  Array.from(rh.landRanks).sort((a, b) => a - b),
);
console.log("Role types:", Array.from(rh.roleTypes).sort());
console.log(
  "Ideology-land combos:",
  Object.fromEntries(
    Array.from(rh.ideologyLandRankCombos).map(([i, ranks]) => [
      i,
      Array.from(ranks).sort((a, b) => a - b),
    ]),
  ),
);
