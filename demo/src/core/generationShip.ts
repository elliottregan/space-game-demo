// Generation Ship — post-Ark Setting. Tighter constraints.

import type { Setting, MegaProject } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";

// Smaller starting deck: exclude Architect roles (visionaries stay on
// Homeworld) and Lands rank 8-9 (no room for grand structures in transit).
const SHIP_DECK = ALL_CARDS.filter((c) => {
  if (c.kind === "role" && c.role === "architect") return false;
  if (c.kind === "land" && c.rank >= 8) return false;
  if (c.id === "keystone-founding-charter") return false;
  if (c.id === "keystone-critical-mass") return false;
  return true;
}).map((c) => c.id);

const LIFE_SUPPORT: MegaProject = {
  id: "the-life-support",
  name: "Life Support",
  description:
    "Keep the ship alive. Play a Straight of Scholar + Preacher + Engineer with The Navigator's Compass.",
  primaryAxis: "axis2",
  primaryDirection: "positive",
  requiredHand: { kind: "straight", ranks: [11, 12, 13] },
  keystoneId: "keystone-navigators-compass",
  monumentEffect: { terrainDelta: { axis2: 2 }, baseMagnitude: 2 },
  flavor: "No planet beneath. Only the ship.",
};

export const GENERATION_SHIP: Setting = {
  id: "generation-ship",
  name: "Generation Ship",
  description: "En route. Closed system. Tight hand, cramped tableau.",
  flavorText:
    "The Ark burns its engines. There is no soil. Only the ship, and what you brought with you.",
  rules: {
    handSize: 6,
    tableauSlots: 3,
    influenceBaseline: 3,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    softTurnLimit: 20,
    dissentLossThreshold: 0.5,
    retrieveInfluenceCost: 1,
    retrieveLandMaterialCost: 2,
    discardMaterialGain: 1,
  },
  startingDeck: SHIP_DECK,
  startingTableau: [],
  megaProjects: [LIFE_SUPPORT],
  shortTermTasks: [],
  transitions: {
    onWin: { "the-life-support": "campaign-end" },
    onLoss: "campaign-end",
  },
};
