// Ruined Homeworld — loss branch.

import type { Setting, MegaProject } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";

const RUINED_DECK = ALL_CARDS.filter((c) => {
  if (c.kind === "role" && c.role === "architect") return false;
  if (c.id === "keystone-navigators-compass") return false;
  if (c.id === "keystone-critical-mass") return false;
  return true;
}).map((c) => c.id);

const RECLAMATION: MegaProject = {
  id: "the-reclamation",
  name: "The Reclamation",
  description: "Rebuild. Play a Flush (5 Heritage) with The Founding Charter.",
  primaryAxis: "axis2",
  primaryDirection: "negative",
  requiredHand: { kind: "flush", ideology: "heritage", count: 5 },
  keystoneId: "keystone-founding-charter",
  monumentEffect: { terrainDelta: { axis2: -3 }, baseMagnitude: 3 },
  flavor: "From the ashes, the patient ones build.",
};

export const RUINED_HOMEWORLD: Setting = {
  id: "ruined-homeworld",
  name: "Ruined Homeworld",
  description: "What the Populace Turned left behind.",
  flavorText:
    "The domes cracked. The old ideology poisoned the soil. Begin with less; rebuild with what remains.",
  rules: {
    handSize: 6,
    tableauSlots: 3,
    influenceBaseline: 2,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    softTurnLimit: 20,
    dissentLossThreshold: 0.4,
    retrieveInfluenceCost: 1,
  },
  startingDeck: RUINED_DECK,
  startingTableau: [],
  megaProjects: [RECLAMATION],
  shortTermTasks: [],
  transitions: {
    onWin: { "the-reclamation": "campaign-end" },
    onLoss: "campaign-end",
  },
};
