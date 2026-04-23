// Homeworld — reference Setting. Redesign: hand-based mega-structure completion.

import type { Setting, MegaProject } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";

// All base cards start in the player's deck (Roles, Lands, base Keystones, and
// the three project-specific Keystones).
const ALL_CARD_IDS = ALL_CARDS.map((c) => c.id);

// -------------------------------------------------------------------------
// Mega-Projects — each defined as required hand (poker pattern) + keystone
// -------------------------------------------------------------------------

const ARK: MegaProject = {
  id: "the-ark",
  name: "The Ark",
  description:
    "A generation ship. Play a Straight in hand (Scholar + Preacher + Engineer, any suits) with The Navigator's Compass.",
  primaryAxis: "axis2",
  primaryDirection: "positive",
  requiredHand: { kind: "straight", ranks: [11, 12, 13] },
  keystoneId: "keystone-navigators-compass",
  monumentEffect: { terrainDelta: { axis2: 5 }, baseMagnitude: 5 },
  flavor: "When the planet cannot be saved, the people leave it.",
};

const COMMUNE: MegaProject = {
  id: "the-commune",
  name: "The Commune",
  description: "Play a Flush in hand (5 Solidarity cards of any kind) with The Founding Charter.",
  primaryAxis: "axis1",
  primaryDirection: "negative",
  requiredHand: { kind: "flush", ideology: "solidarity", count: 5 },
  keystoneId: "keystone-founding-charter",
  monumentEffect: { terrainDelta: { axis1: -5 }, baseMagnitude: 5 },
  flavor: "Shared labor, shared tables, shared fate.",
};

const REACTOR: MegaProject = {
  id: "the-reactor",
  name: "The Reactor",
  description:
    "Play Four-of-a-Kind in hand (all 4 Engineers, one of each ideology) with Critical Mass.",
  primaryAxis: "axis1",
  primaryDirection: "positive",
  requiredHand: { kind: "four-of-a-kind", role: "engineer", count: 4 },
  keystoneId: "keystone-critical-mass",
  monumentEffect: { terrainDelta: { axis1: 5 }, baseMagnitude: 5 },
  flavor: "Power, harnessed. Power, ordered.",
};

// -------------------------------------------------------------------------
// Setting
// -------------------------------------------------------------------------

export const HOMEWORLD: Setting = {
  id: "homeworld",
  name: "Homeworld",
  description: "The first world. Fresh ground, unsettled ideology.",
  flavorText:
    "Mars under a dome. The first generation debates what comes next: to dig in, to lift off, or to build something neither.",
  rules: {
    handSize: 7,
    tableauSlots: 4,
    influenceBaseline: 3,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    softTurnLimit: 24,
    dissentLossThreshold: 0.5,
    retrieveInfluenceCost: 1,
  },
  startingDeck: ALL_CARD_IDS,
  startingTableau: [],
  megaProjects: [ARK, COMMUNE, REACTOR],
  shortTermTasks: [],
  transitions: {
    onWin: {
      "the-ark": "generation-ship",
      "the-commune": "campaign-end",
      "the-reactor": "campaign-end",
    },
    onLoss: "ruined-homeworld",
  },
};
