// Ruined Homeworld Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, CrisisTree } from "../types.ts";
import { ALL_CARDS } from "../data/cards.ts";
import { DEFAULT_PROJECT_VALUE } from "../data/projects.ts";

const ALL_CARD_IDS = ALL_CARDS.map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  {
    id: "ruin-candle",
    pattern: "high-card",
    name: "Candle in the Dust",
    flavor: "Something burns again.",
    value: DEFAULT_PROJECT_VALUE["high-card"],
  },
  {
    id: "ruin-two-stones",
    pattern: "pair",
    name: "Two Stones Reset",
    flavor: "The first wall returns.",
    value: DEFAULT_PROJECT_VALUE["pair"],
  },
  {
    id: "ruin-third-pillar",
    pattern: "three-of-a-kind",
    name: "Third Pillar",
    flavor: "Memory is laid in threes.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"],
  },
  {
    id: "ruin-monoculture",
    pattern: "flush",
    name: "Monoculture",
    flavor: "One belief survives, for now.",
    value: DEFAULT_PROJECT_VALUE["flush"],
  },
  {
    id: "ruin-cornerstones",
    pattern: "four-of-a-kind",
    name: "The Cornerstones",
    flavor: "Four corners hold what is left.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"],
  },
  {
    id: "ruin-salvage-pair",
    pattern: "two-pair",
    name: "Salvage Pact",
    flavor: "Two debts, two promises. Enough to trade on.",
    value: DEFAULT_PROJECT_VALUE["two-pair"],
  },
  {
    id: "ruin-broken-road",
    pattern: "straight",
    name: "The Broken Road",
    flavor: "Five waypoints cleared. The route holds, mostly.",
    value: DEFAULT_PROJECT_VALUE["straight"],
  },
  {
    id: "ruin-hearth-and-wall",
    pattern: "full-house",
    name: "Hearth and Wall",
    flavor: "Three kept the fire. Two kept the gate. It was enough.",
    value: DEFAULT_PROJECT_VALUE["full-house"],
  },
  {
    id: "ruin-clean-line",
    pattern: "straight-flush",
    name: "Clean Line",
    flavor: "One creed, one road. The scar runs straight.",
    value: DEFAULT_PROJECT_VALUE["straight-flush"],
  },
  {
    id: "ruin-first-accord",
    pattern: "royal-flush",
    name: "The First Accord",
    flavor: "Every voice, one tongue. The ruins sign the founding charter.",
    value: DEFAULT_PROJECT_VALUE["royal-flush"],
  },
];

const CRISIS: Crisis = {
  id: "ruin-collapse",
  name: "The Long Collapse",
  flavor: "What was once a city must be coaxed back into shape.",
};

// Crisis Tree (Ruined Homeworld, 16 turns / 5 columns, full deck). The
// longest clock and the full ideology spread make every pattern reachable, so
// the root demands a wider re-founding spread and the terminals are a touch
// heavier than Homeworld. Counts are balance-pending strawman.
const CRISIS_TREE: CrisisTree = {
  rootId: "refounding",
  nodes: {
    refounding: {
      id: "refounding",
      name: "Re-founding",
      branch: "establish",
      requirements: [
        { pattern: "two-pair", count: 5 },
        { pattern: "pair", count: 5 },
        { pattern: "high-card", count: 5 },
      ],
      unlocks: ["reclamation", "creed", "spire"],
      terminal: false,
    },
    reclamation: {
      id: "reclamation",
      name: "Reclamation",
      branch: "expansion",
      requirements: [{ pattern: "any", count: 18 }],
      unlocks: [],
      terminal: true,
    },
    creed: {
      id: "creed",
      name: "Creed",
      branch: "doctrine",
      requireSameIdeology: true,
      // Doctrine teeth: same-color builds AND slotted policies of that color.
      requirements: [{ pattern: "any", count: 11 }],
      policyStrength: 4,
      unlocks: [],
      terminal: true,
    },
    spire: {
      id: "spire",
      name: "Spire",
      branch: "wonder",
      // The rare-shape branch on the long full-deck clock: straights, two-pairs,
      // and two upgraded flushes. Heavier so it stays a flush/straight specialty
      // rather than the universal cheapest terminal.
      requirements: [
        { pattern: "straight", count: 2 },
        { pattern: "two-pair", count: 3 },
        { pattern: "flush", count: 2, upgrade: true },
      ],
      unlocks: [],
      terminal: true,
    },
  },
};

export const RUINED_HOMEWORLD: Setting = {
  id: "ruined-homeworld",
  name: "Ruined Homeworld",
  description: "Return to a scarred world. Salvage and re-found.",
  flavorText: "The dome cracked. The fields turned. Begin again.",
  rules: {
    baseHandSize: 7,
    columnCount: 5,
    baseInfluenceBaseline: 8,
    maxTurns: 16,
    baseStorageCapacity: 1,
  },
  startingDeck: ALL_CARD_IDS,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  crisisTree: CRISIS_TREE,
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
